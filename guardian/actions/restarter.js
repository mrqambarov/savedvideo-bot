'use strict';
const { exec } = require('child_process');
const { sendRecoveryAlert, sendCriticalAlert } = require('./alerter');

// PM2 jarayon nomlarini restart qilishdagi kutish vaqtlari (ms)
const RESTART_COOLDOWNS = new Map(); // processName => lastRestartTimestamp
const RESTART_COOLDOWN_MS = 2 * 60 * 1000; // bir jarayonni 2 daqiqada bir marta restart

/**
 * Shell buyrug'ini ishga tushirish va natijasini qaytarish
 */
function runCmd(cmd, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = exec(
      `export PATH=$PATH:/usr/local/bin:/usr/bin:/usr/sbin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin && ${cmd}`,
      { timeout: timeoutMs },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      }
    );
  });
}

/**
 * Qotib qolgan yoki zombi jarayon portni band qilib turgan bo'lsa, uni tozalaydi
 * @param {number} port
 */
async function freePortIfOccupied(port) {
  try {
    // Linux fuser / lsof yordamida portni bo'shatish
    await runCmd(`fuser -k ${port}/tcp 2>/dev/null || true`);
    console.log(`[Zombie Slayer] Port :${port} tozalandi.`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * PM2 jarayonini restart qiladi (port tozalash va cooldown tekshiruvi bilan)
 * @param {string} processName - PM2 jarayon nomi (masalan 'vibeconvert-bot')
 * @param {boolean} [force=false] - Cooldowndan qat'iy nazar majburiy restart
 * @returns {Promise<boolean>} - Muvaffaqiyatli bo'ldimi
 */
async function restartProcess(processName, force = false) {
  const lastRestart = RESTART_COOLDOWNS.get(processName);
  if (!force && lastRestart && Date.now() - lastRestart < RESTART_COOLDOWN_MS) {
    console.log(`[Guardian Restarter] ${processName} cooldown davomida, restart o'tkazib yuborildi.`);
    return false;
  }

  RESTART_COOLDOWNS.set(processName, Date.now());
  console.log(`[Guardian Restarter] "${processName}" restart qilinmoqda...`);

  // Port bog'lanishi bo'yicha tozalash
  const portMap = {
    'vibeconvert-bot': 5000,
    'movie-bot': 5001,
    'adult-bot': 5002
  };
  if (portMap[processName]) {
    await freePortIfOccupied(portMap[processName]);
  }

  try {
    await runCmd(`pm2 restart ${processName} --update-env`);
    console.log(`[Guardian Restarter] "${processName}" muvaffaqiyatli restart qilindi.`);
    await sendRecoveryAlert(processName, 'pm2 restart & port clean', true);
    return true;
  } catch (err) {
    console.error(`[Guardian Restarter] "${processName}" restart qilishda xato:`, err.message);
    await sendCriticalAlert(`PM2 Restart Failed: ${processName}`, err.message);
    return false;
  }
}

/**
 * PM2 jarayonining oxirgi loglarini oladi
 * @param {string} processName
 * @param {number} [lines=20]
 */
async function fetchProcessLogs(processName = 'vibeconvert-bot', lines = 20) {
  try {
    const out = await runCmd(`pm2 logs ${processName} --lines ${lines} --nostream`, 10000);
    return out || 'Loglar bo\'sh';
  } catch (err) {
    return `Loglarni o'qishda xato: ${err.message}`;
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
 * Barcha PM2 jarayonlarini restart qiladi
 */
async function restartAllProcesses() {
  console.log('[Guardian Restarter] Barcha jarayonlar restart qilinmoqda...');
  try {
    await freePortIfOccupied(5000);
    await freePortIfOccupied(5001);
    await freePortIfOccupied(5002);
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
    await runCmd('certbot renew --quiet --no-self-upgrade', 60000);
    await runCmd('systemctl reload nginx');
    await sendRecoveryAlert('SSL sertifikat', 'certbot renew', true);
    return true;
  } catch (err) {
    await sendCriticalAlert('SSL Renew Failed', err.message);
    return false;
  }
}

module.exports = {
  restartProcess,
  reloadNginx,
  restartAllProcesses,
  renewSSL,
  runCmd,
  freePortIfOccupied,
  fetchProcessLogs
};
