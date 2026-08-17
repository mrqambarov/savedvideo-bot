'use strict';
const fs = require('fs');
const path = require('path');
const { sendAlert } = require('./alerter');

const BASE_DIR = path.join(__dirname, '..', '..');

// Tozalanadigan temp papkalar
const TEMP_DIRS = [
  path.join(BASE_DIR, 'server', 'temp'),
  path.join(BASE_DIR, 'adult-server', 'temp'),
];

const MAX_FILE_AGE_MS = 2 * 60 * 60 * 1000; // 2 soatdan eski fayllar o'chiriladi
const WARN_THRESHOLD_MB = 500; // 500MB dan oshsa ogohlantirish

/**
 * Berilgan papkadagi eski fayllarni tozalaydi
 * @param {string} dir - Papka yo'li
 * @returns {{ deleted: number, freedMB: number }}
 */
function cleanDirectory(dir) {
  let deleted = 0;
  let freedBytes = 0;

  if (!fs.existsSync(dir)) return { deleted: 0, freedMB: 0 };

  try {
    const files = fs.readdirSync(dir);
    const now = Date.now();

    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile() && now - stat.mtimeMs > MAX_FILE_AGE_MS) {
          freedBytes += stat.size;
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (e) {
        // Fayl o'chirishda xato — o'tkazib yuborish
      }
    }
  } catch (e) {
    console.error(`[Guardian Cleaner] ${dir} papkasini tozalashda xato:`, e.message);
  }

  return { deleted, freedMB: parseFloat((freedBytes / 1024 / 1024).toFixed(2)) };
}

/**
 * PM2 log fayllarini qisqartiradi
 */
async function trimPm2Logs() {
  try {
    const { runCmd } = require('./restarter');
    await runCmd('pm2 flush');
    console.log('[Guardian Cleaner] PM2 loglari tozalandi.');
  } catch (e) {
    console.error('[Guardian Cleaner] PM2 flush xatosi:', e.message);
  }
}

/**
 * Barcha temp papkalarni tozalaydi va natijani qaytaradi
 */
async function cleanAllTempDirs() {
  let totalDeleted = 0;
  let totalFreedMB = 0;

  for (const dir of TEMP_DIRS) {
    const { deleted, freedMB } = cleanDirectory(dir);
    totalDeleted += deleted;
    totalFreedMB += freedMB;
    if (deleted > 0) {
      console.log(`[Guardian Cleaner] ${dir}: ${deleted} fayl o'chirildi, ${freedMB}MB bo'shatildi.`);
    }
  }

  if (totalFreedMB > WARN_THRESHOLD_MB) {
    await sendAlert(
      `🧹 <b>Avto-tozalash bajarildi:</b>\n` +
      `• O'chirilgan fayllar: <b>${totalDeleted} ta</b>\n` +
      `• Bo'shatilgan joy: <b>${totalFreedMB.toFixed(1)} MB</b>`,
      'cleanup_done',
      'info'
    );
  }

  return { totalDeleted, totalFreedMB };
}

module.exports = { cleanAllTempDirs, trimPm2Logs };
