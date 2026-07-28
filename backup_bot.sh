#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-$TOKEN}"
ADMIN="${ADMIN_ID:-$ADMIN_ID}"

if [ -z "$TOKEN" ] || [ -z "$ADMIN" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN or ADMIN_ID is not configured."
  exit 1
fi

DATE=$(date +"%Y-%m-%d")
FILE="/tmp/backup_$DATE.zip"

zip -r $FILE /root/savedvideo/server/data /root/savedvideo/movie-server/data

curl -F chat_id=$ADMIN -F document=@$FILE https://api.telegram.org/bot$TOKEN/sendDocument
rm -f $FILE

