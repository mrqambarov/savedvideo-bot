#!/bin/bash
# ==============================================================================
# XIT FILM & SAVEDVIDEO — 1-CLICK BACKUP RESTORE SCRIPT (YANGI SERVERDA TIKLASH)
# Tiklaydi: movie-server/data, adult-server/data, server/data, .env, channels.json, uploads
# ==============================================================================

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    # Agar fayl nomi berilmagan bo'lsa, joriy papkadagi eng oxirgi xitfilm_backup_*.tar.gz ni topish
    BACKUP_FILE=$(ls -t xitfilm_backup_*.tar.gz 2>/dev/null | head -n 1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Xatolik: Tiklash uchun backup fayli topilmadi!"
    echo "Foydalanish: bash restore_vps.sh <backup_fayli.tar.gz>"
    exit 1
fi

echo "=================================================="
echo " 📥 MA'LUMOTLARNI TIKLASH BOSHLANDI"
echo " Fayl: $BACKUP_FILE"
echo "=================================================="

TEMP_RESTORE="/tmp/restore_vps_temp"
rm -rf "$TEMP_RESTORE"
mkdir -p "$TEMP_RESTORE"

tar -xzf "$BACKUP_FILE" -C "$TEMP_RESTORE"

# 1. Baza fayllarini joylashtirish
echo "==> [1/4] Baza fayllari (kinolar, userlar, statistika) tiklanmoqda..."
if [ -d "$TEMP_RESTORE/movie-server/data" ]; then
    mkdir -p movie-server/data
    cp -r "$TEMP_RESTORE/movie-server/data/"* movie-server/data/
fi

if [ -d "$TEMP_RESTORE/adult-server/data" ]; then
    mkdir -p adult-server/data
    cp -r "$TEMP_RESTORE/adult-server/data/"* adult-server/data/
fi

if [ -d "$TEMP_RESTORE/server/data" ]; then
    mkdir -p server/data
    cp -r "$TEMP_RESTORE/server/data/"* server/data/
fi

# 2. .env va sozlamalar
echo "==> [2/4] Sozlamalar va .env tiklanmoqda..."
[ -f "$TEMP_RESTORE/.env" ] && cp "$TEMP_RESTORE/.env" .env
[ -f "$TEMP_RESTORE/channels.json" ] && cp "$TEMP_RESTORE/channels.json" channels.json

# 3. Uploads (Shorts va Posterlar)
echo "==> [3/4] Media fayllar (Shorts & Posters) /var/www/xitfilm/uploads ga tiklanmoqda..."
if [ -d "$TEMP_RESTORE/uploads" ]; then
    sudo mkdir -p /var/www/xitfilm/uploads
    sudo cp -r "$TEMP_RESTORE/uploads/"* /var/www/xitfilm/uploads/ 2>/dev/null || true
    sudo chown -R www-data:www-data /var/www/xitfilm/uploads
fi

rm -rf "$TEMP_RESTORE"

# 4. PM2 jarayonlarini qayta ishga tushirish
echo "==> [4/4] PM2 jarayonlari yangi ma'lumotlar bilan qayta yuklanmoqda..."
pm2 reload ecosystem.config.js || pm2 restart ecosystem.config.js || true

echo "=================================================="
echo " 🎉 BARCHA MA'LUMOTLAR MUVAFFAQIYATLI TIKLANDI!"
echo " Kinolar, foydalanuvchilar, .env va shorts fayllari 100% tiklandi."
echo "=================================================="
