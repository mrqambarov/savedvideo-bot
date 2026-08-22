'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { sendAlert } = require('./alerter');
const { runCmd } = require('./restarter');

const BASE_DIR = path.join(__dirname, '..', '..');

// Tozalanadigan temp papkalar
const TEMP_DIRS = [
  path.join(BASE_DIR, 'server', 'temp'),
  path.join(BASE_DIR, 'server', 'temp', 'uploads'),
  path.join(BASE_DIR, 'movie-server', 'temp'),
  path.join(BASE_DIR, 'adult-server', 'temp'),
  process.platform === 'win32' ? path.join(os.tmpdir(), 'savedvideo-temp') : '/tmp'
];

const MAX_FILE_AGE_MS = 60 * 60 * 1000; // 1 soatdan eski umumiy fayllar
const PART_FILE_AGE_MS = 15 * 60 * 1000; // 15 daqiqadan oshgan chala yuklamalar (.part, .ytdl, .frag)
const WARN_THRESHOLD_MB = 500; // 500MB dan oshsa ogohlantirish

/**
 * Berilgan papkadagi eski va chala yuklangan fayllarni tozalaydi
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
      // Muhim tizim fayllarini tegmang
      if (file.startsWith('.') || file.includes('systemd') || file.includes('ssh')) continue;
      
      try {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          const age = now - stat.mtimeMs;
          const isPartialOrTemp = file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.tmp') || file.endsWith('.frag') || file.endsWith('.temp');
          const isMediaTemp = file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.m4a') || file.endsWith('.mp3') || file.endsWith('.pcm');

          if ((isPartialOrTemp && age > PART_FILE_AGE_MS) || (isMediaTemp && age > 30 * 60 * 1000) || age > MAX_FILE_AGE_MS) {
            freedBytes += stat.size;
            fs.unlinkSync(filePath);
            deleted++;
          }
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
 * PM2 log fayllarini tozalaydi
 */
async function trimPm2Logs() {
  try {
    await runCmd('pm2 flush');
    console.log('[Guardian Cleaner] PM2 loglari tozalandi.');
    return true;
  } catch (e) {
    console.error('[Guardian Cleaner] PM2 flush xatosi:', e.message);
    return false;
  }
}

/**
 * Chuqur tozalash (Deep Clean) - Admin tugmasi yoki kritik xotira holatida
 */
async function performDeepClean() {
  console.log('[Guardian Cleaner] Chuqur tozalash boshlandi...');
  let totalDeleted = 0;
  let totalFreedMB = 0;

  for (const dir of TEMP_DIRS) {
    const { deleted, freedMB } = cleanDirectory(dir);
    totalDeleted += deleted;
    totalFreedMB += freedMB;
  }

  await trimPm2Logs();

  // Linux tizim keshini tozalash
  try {
    if (process.platform !== 'win32') {
      await runCmd('sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true');
    }
  } catch (_) {}

  return { totalDeleted, totalFreedMB };
}

/**
 * Barcha 3 ta bot bazalarini (Downloader, Kino, 18+ Adult) arxivlab ZIP fayl yaratadi
 * @returns {Promise<string|null>} - Zip fayl yo'li
 */
async function createFullBackupZip() {
  const dateStr = new Date().toISOString().split('T')[0];
  const outDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';
  const zipPath = path.join(outDir, `guardian_backup_${dateStr}_${Date.now()}.zip`);

  const serverData = path.join(BASE_DIR, 'server', 'data');
  const movieData = path.join(BASE_DIR, 'movie-server', 'data');
  const adultData = path.join(BASE_DIR, 'adult-server', 'data');
  const channelsJson = path.join(BASE_DIR, 'channels.json');

  try {
    if (process.platform === 'win32') {
      // Windows PowerShell Compress-Archive or tar
      await runCmd(`powershell -Command "Compress-Archive -Path '${serverData}','${movieData}','${adultData}','${channelsJson}' -DestinationPath '${zipPath}' -Force"`, 60000);
    } else {
      // Linux zip command
      await runCmd(`zip -r "${zipPath}" "${serverData}" "${movieData}" "${adultData}" "${channelsJson}" 2>/dev/null || tar -czf "${zipPath}" "${serverData}" "${movieData}" "${adultData}" "${channelsJson}" 2>/dev/null`, 60000);
    }

    if (fs.existsSync(zipPath)) {
      return zipPath;
    }
    return null;
  } catch (err) {
    console.error('[Guardian Backup] Zip yaratishda xato:', err.message);
    return null;
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

module.exports = { cleanAllTempDirs, trimPm2Logs, performDeepClean, createFullBackupZip };

