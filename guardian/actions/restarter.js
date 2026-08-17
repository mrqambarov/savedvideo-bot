'use strict';
const { exec } = require('child_process');
const { sendRecoveryAlert, sendCriticalAlert } = require('./alerter');

// PM2 jarayon nomlarini restart qilishdagi kutish vaqtlari (ms)
const RESTART_COOLDOWNS = new Map(); // processName => lastRestartTimestamp
const RESTART_COOLDOWN_MS = 3 * 60 * 1000; // bir jarayonni 3 daqiqada bir marta restart

/**
 * Shell buyrug'ini ishga tushirish va natijasini qaytarish
 */
function runCmd(cmd, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = exec(
      `export PATH=$PATH:/usr/local/bin:/usr/bin:/usr/sbin && ${cmd}`,
      { timeout: timeoutMs },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      }
    );
  });
}

/**
 * PM2 jarayonini restart qiladi (cooldown tekshiruvi bilan)
 * @param {string} processName - PM2 jarayon nomi (masalan 'vibeconvert-bot')
 * @returns {Promise<boolean>} - Muvaffaqiyatli bo'ldimi
 */
async function restartProcess(processName) {
  const lastRestart = RESTART_COOLDOWNS.get(processName);
  if (lastRestart && Date.now() - lastRestart < RESTART_COOLDOWN_MS) {
    console.log(`[Guardian Restarter] ${processName} cooldown davomida, restart o'tkazib yuborildi.`);
    return false;
  }

  RESTART_COOLDOWNS.set(processName, Date.now());
  console.log(`[Guardian Restarter] "${processName}" restart qilinmoqda...`);

  try {
    await runCmd(`pm2 restart ${processName} --update-env`);
    console.log(`[Guardian Restarter] "${processName}" muvaffaqiyatli restart qilindi.`);
    await sendRecoveryAlert(processName, 'pm2 restart', true);
    return true;
  } catch (err) {
    console.error(`[Guardian Restarter] "${processName}" restart qilishda xato:`, err.message);
    await sendCriticalAlert(`PM2 Restart Failed: ${processName}`, err.message);
    return false;
  }
}

/**
 * Nginx ni tekshirib qayta yuklaydi
 * @returns {Promise<boolean>}
 */
async function reloadNginx() {
  console.log('[Guardian Restarter] Nginx qayta yuklanmoqda...');
  try {
    await runCmd('nginx -t'); // Sintaksisni tekshirish
    await runCmd('systemctl reload nginx');
    console.log('[Guardian Restarter] Nginx muvaffaqiyatli qayta yuklandi.');
    await sendRecoveryAlert('nginx', 'systemctl reload nginx', true);
    return true;
  } catch (err) {
    console.error('[Guardian Restarter] Nginx reload xatosi:', err.message);
    // Agar reload ishlamasa, restart urinib ko'rish
    try {
      await runCmd('systemctl restart nginx');
      await sendRecoveryAlert('nginx', 'systemctl restart nginx (fallback)', true);
      return true;
    } catch (err2) {
      await sendCriticalAlert('Nginx Restart Failed', err2.message);
      return false;
    }
  }
}

/**
 * Barcha PM2 jarayonlarini restart qiladi (RAM to'lib ketganda)
 */
async function restartAllProcesses() {
  console.log('[Guardian Restarter] Barcha jarayonlar restart qilinmoqda...');
  try {
    await runCmd('pm2 restart all --update-env');
    await sendRecoveryAlert('barcha jarayonlar', 'pm2 restart all', true);
    return true;
  } catch (err) {
    await sendCriticalAlert('pm2 restart all Failed', err.message);
    return false;
  }
}

/**
 * SSL sertifikatni yangilaydi
 */
async function renewSSL() {
  console.log('[Guardian Restarter] SSL sertifikat yangilanmoqda...');
  try {
    const out = await runCmd('certbot renew --quiet --no-self-upgrade', 60000);
    await runCmd('systemctl reload nginx');
    await sendRecoveryAlert('SSL sertifikat', 'certbot renew', true);
    return true;
  } catch (err) {
    await sendCriticalAlert('SSL Renew Failed', err.message);
    return false;
  }
}

module.exports = { restartProcess, reloadNginx, restartAllProcesses, renewSSL, runCmd };
