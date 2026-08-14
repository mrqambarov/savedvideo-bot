#!/bin/bash

# Exit on error
set -e

DOMAIN="xitfilm.uz"
SERVER_IP="94.237.103.133"

echo "=========================================="
echo " Starting VPS Deployment for $DOMAIN "
echo "=========================================="

# 1. Update package list and install system dependencies
echo "==> [1/8] Updating system packages & installing FFmpeg, Nginx, Certbot..."
sudo apt-get update -y
sudo apt-get install -y curl git ffmpeg nginx certbot python3-certbot-nginx build-essential

# 2. Check & Install Node.js 20 LTS if missing
if ! command -v node &> /dev/null; then
    echo "==> [2/8] Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "==> Node.js is already installed: $(node -v)"
fi

# 3. Check & Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "==> [3/8] Installing PM2 process manager..."
    sudo npm install -g pm2
fi

# 4. Install Project Dependencies & Build Frontends
echo "==> [4/8] Installing NPM packages..."
npm run install:all || npm install

echo "==> Building Admin Panel & Client apps..."
if [ -d "admin-panel" ]; then
    npm run build --prefix admin-panel || echo "Admin build skipped or completed."
fi

if [ -d "client" ]; then
    npm run build --prefix client || echo "Client build skipped or completed."
fi

if [ -d "movie-client" ]; then
    npm run build --prefix movie-client || echo "Movie client build skipped or completed."
fi

# 5. Deploy Public Cinema Site
echo "==> [5/8] Deploying public cinema site to /var/www/xitfilm..."
sudo mkdir -p /var/www/xitfilm
sudo cp -r public-site/* /var/www/xitfilm/
if [ -d "admin-panel/dist" ]; then
    sudo mkdir -p /var/www/xitfilm/panel
    sudo cp -r admin-panel/dist/* /var/www/xitfilm/panel/
fi
sudo chown -R www-data:www-data /var/www/xitfilm
echo "==> Public site deployed successfully."

# 6. Run Server Setup (Download yt-dlp & set executable permissions)
echo "==> [6/8] Running server binary setup..."
node server/setup.js || true
chmod +x server/bin/yt-dlp 2>/dev/null || true

# 7. Configure Nginx
echo "==> [7/8] Configuring Nginx reverse proxy..."
if [ -f "nginx_xitfilm.conf" ]; then
    sudo cp nginx_xitfilm.conf /etc/nginx/sites-available/$DOMAIN
    sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx
    echo "==> Nginx configured and reloaded successfully."
fi

# 8. Start/Restart PM2 Apps & Save Startup Configuration
echo "==> [8/8] Starting backend services with PM2..."
pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo "=========================================="
echo " Obtaining Free SSL Certificate via Certbot..."
echo "=========================================="
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || echo "Certbot notice: Make sure DNS A record for $DOMAIN is pointing to $SERVER_IP"

echo "=========================================="
echo " DEPLOYMENT COMPLETE! "
echo " Website URL: https://$DOMAIN "
echo " Status check: pm2 status "
echo "=========================================="
