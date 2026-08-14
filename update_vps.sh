#!/bin/bash
set -e

echo "=========================================="
echo " Updating XIT FILM Services on VPS "
echo "=========================================="

echo "==> [1/5] Pulling latest updates from Git..."
git pull origin main

echo "==> [2/5] Installing any new dependencies & Building Frontends..."
if [ -d "admin-panel" ]; then
    echo "==> Building Admin Panel..."
    npm run build --prefix admin-panel
fi

if [ -d "movie-client" ]; then
    echo "==> Building Movie Client (Mini App)..."
    npm run build --prefix movie-client
fi

echo "==> [3/5] Deploying Web files to /var/www/xitfilm..."
sudo mkdir -p /var/www/xitfilm
sudo cp -r public-site/* /var/www/xitfilm/
if [ -d "admin-panel/dist" ]; then
    sudo mkdir -p /var/www/xitfilm/panel
    sudo cp -r admin-panel/dist/* /var/www/xitfilm/panel/
fi
sudo chown -R www-data:www-data /var/www/xitfilm

echo "==> [4/5] Reloading PM2 bot processes..."
pm2 reload ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save

echo "==> [5/5] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "=========================================="
echo " ✅ VPS UPDATE & DEPLOYMENT COMPLETED! "
echo " Website: https://xitfilm.uz "
echo " Shorts:  https://xitfilm.uz/shorts.html "
echo " Panel:   https://xitfilm.uz/panel "
echo "=========================================="
