#!/bin/bash
# ==============================================================================
# XIT FILM & SAVEDVIDEO — 1-CLICK FULL VPS BACKUP SCRIPT
# Arxivlaydi: Barcha databaselar, foydalanuvchilar, kinolar, sozlamalar, .env va uploads
# ==============================================================================

set -e

BACKUP_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="xitfilm_backup_${BACKUP_DATE}.tar.gz"
BACKUP_DIR="/root/backups"

mkdir -p "$BACKUP_DIR"

echo "=================================================="
echo " 📦 VPS TO'LIQ BACKUP YARATILMOQDA..."
echo " Sana: $BACKUP_DATE"
echo "=================================================="

# Vaqtinchalik papka
TEMP_DIR="/tmp/backup_vps_${BACKUP_DATE}"
mkdir -p "$TEMP_DIR"

# 1. Loyihaning data papkalarini nusxalash
echo "==> [1/4] Bazalar (JSON DB) nusxalanmoqda..."
mkdir -p "$TEMP_DIR/movie-server" "$TEMP_DIR/adult-server" "$TEMP_DIR/server"

[ -d "movie-server/data" ] && cp -r movie-server/data "$TEMP_DIR/movie-server/"
[ -d "adult-server/data" ] && cp -r adult-server/data "$TEMP_DIR/adult-server/"
[ -d "server/data" ] && cp -r server/data "$TEMP_DIR/server/"

# 2. Asosiy sozlamalar va .env
echo "==> [2/4] Konfiguratsiya fayllari (.env, channels.json)..."
[ -f ".env" ] && cp .env "$TEMP_DIR/"
[ -f "channels.json" ] && cp channels.json "$TEMP_DIR/"

# 3. Yuklangan videolar va posterlar (/var/www/xitfilm/uploads)
echo "==> [3/4] Media fayllar (Shorts & Posters uploads)..."
if [ -d "/var/www/xitfilm/uploads" ]; then
    mkdir -p "$TEMP_DIR/uploads"
    cp -r /var/www/xitfilm/uploads/* "$TEMP_DIR/uploads/" 2>/dev/null || true
fi

# 4. Barchasini bitta ixcham arxivga yig'ish
echo "==> [4/4] Arxiv (.tar.gz) yaratilmoqda..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C "$TEMP_DIR" .
rm -rf "$TEMP_DIR"

# Joriy papkaga ham nusxa qo'yish (oson ko'chirish uchun)
cp "$BACKUP_DIR/$BACKUP_NAME" "./$BACKUP_NAME"

BACKUP_SIZE=$(du -sh "./$BACKUP_NAME" | cut -f1)

echo "=================================================="
echo " ✅ BACKUP MUVAFFAQIYATLI YARATILDI!"
echo " Fayl: ./$BACKUP_NAME"
echo " Hajmi: $BACKUP_SIZE"
echo "=================================================="
echo "Yangi serverga ko'chirish uchun buyruq:"
echo "scp ./$BACKUP_NAME root@YANGI_SERVER_IP:/root/savedvideo/"
echo "=================================================="
