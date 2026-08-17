'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        GUARDIAN AI BRAIN & SELF-HEALING DOCTOR               ║
 * ║  Xatolik sababini tahlil qiladi, kod va fayllarni tekshiradi ║
 * ║  va avtomatik tarzda to'g'ri davolash usulini qo'llaydi     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const fs = require('fs');
const path = require('path');
const { runCmd, restartProcess, freePortIfOccupied, reloadNginx, restartAllProcesses } = require('../actions/restarter');
const { performDeepClean } = require('../actions/cleaner');
const { healDatabase } = require('../actions/dbHealer');
const { sendAlert, sendCriticalAlert } = require('../actions/alerter');
const { updateYtDlp } = require('../checks/downloaderCheck');

const BASE_DIR = path.join(__dirname, '..', '..');
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'healing_history.json');

// Tarix papkasini yaratish
if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

/**
 * Tuzatish tarixini saqlaydi
 */
function recordHealingAction(incident, rootCause, actionTaken, success) {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const history = JSON.parse(raw);
    const item = {
      id: 'fix_' + Date.now(),
      timestamp: new Date().toISOString(),
      incident,
      rootCause,
      actionTaken,
      success
    };
    history.unshift(item);
    if (history.length > 100) history.pop(); // Oxirgi 100 ta saqlanadi
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return item;
  } catch (_) {
    return null;
  }
}

function getHealingHistory(limit = 20) {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const history = JSON.parse(raw);
    return history.slice(0, limit);
  } catch (_) {
    return [];
  }
}

/**
 * 1. Kod Fayllari Sintaksisini Tekshirish va Himoyalash
 * `node -c <file>` orqali JS fayllar sintaktik to'g'riligini tekshiradi
 */
async function diagnoseCodeSyntax() {
  const criticalFiles = [
    path.join(BASE_DIR, 'server', 'index.js'),
    path.join(BASE_DIR, 'server', 'bot.js'),
    path.join(BASE_DIR, 'server', 'api.js'),
    path.join(BASE_DIR, 'server', 'downloader.js'),
    path.join(BASE_DIR, 'movie-server', 'index.js'),
    path.join(BASE_DIR, 'movie-server', 'bot.js'),
    path.join(BASE_DIR, 'adult-server', 'index.js'),
    path.join(BASE_DIR, 'adult-server', 'bot.js'),
    path.join(BASE_DIR, 'guardian', 'index.js')
  ];

  const results = [];
  for (const file of criticalFiles) {
    if (!fs.existsSync(file)) continue;
    try {
      await runCmd(`node -c "${file}"`, 5000);
      results.push({ file: path.basename(file), ok: true });
    } catch (err) {
      console.error(`[AI Doctor] Sintaksis xatosi: ${file} -> ${err.message}`);
      results.push({ file: path.basename(file), ok: false, error: err.message });
      
      recordHealingAction(
        `Syntax Error in ${path.basename(file)}`,
        'Code corruption or incomplete edit',
        'Syntax alert dispatched',
        false
      );

      await sendCriticalAlert(
        `Kodda Sintaksis Xatosi: ${path.basename(file)}`,
        `<code>${err.message.substring(0, 400)}</code>\n\nIltimos, kodni tekshiring.`
      );
    }
  }
  return results;
}

/**
 * 2. Aqlli Xatolik Klassifikatori va Avtomatik Davolovchi (AI Doctor Dispatcher)
 * Xatolik matniga qarab to'g'ri tuzatish choralarni avtomatik tanlaydi
 * @param {string} serviceName
 * @param {string} errorMessage
 * @returns {Promise<{ diagnosed: boolean, action: string, success: boolean }>}
 */
async function diagnoseAndHeal(serviceName, errorMessage = '') {
  const err = (errorMessage || '').toLowerCase();
  console.log(`[AI Doctor] Diagnostika: [${serviceName}] -> "${errorMessage.substring(0, 100)}"`);

  // Ssenariy 1: Port band / EADDRINUSE
  if (err.includes('eaddrinuse') || err.includes('address already in use') || err.includes('port')) {
    const portMap = { 'vibeconvert-bot': 5000, 'movie-bot': 5001, 'adult-bot': 5002 };
    const port = portMap[serviceName] || 5000;
    console.log(`[AI Doctor] Ssenariy: Port ${port} band. Port tozalash va restart...`);
    await freePortIfOccupied(port);
    const ok = await restartProcess(serviceName, true);
    recordHealingAction(`Port :${port} EADDRINUSE on ${serviceName}`, 'Zombie process holding port', `freePort(${port}) & restart`, ok);
    return { diagnosed: true, action: `Port :${port} bo'shatildi va ${serviceName} qayta ishga tushirildi`, success: ok };
  }

  // Ssenariy 2: Telegram Webhook / 409 Conflict
  if (err.includes('409') || err.includes('conflict') || err.includes('getupdates') || err.includes('webhook')) {
    console.log(`[AI Doctor] Ssenariy: 409 Conflict. Webhook tozalash va restart...`);
    const ok = await restartProcess(serviceName, true);
    recordHealingAction(`409 Conflict on ${serviceName}`, 'Duplicate polling or active webhook', 'deleteWebhook & restart', ok);
    return { diagnosed: true, action: `409 ziddiyati tozalandi va ${serviceName} qayta ulandi`, success: ok };
  }

  // Ssenariy 3: Missing Node Package / MODULE_NOT_FOUND
  if (err.includes('cannot find module') || err.includes('module_not_found')) {
    console.log(`[AI Doctor] Ssenariy: Paket yetishmayapti. npm install ishga tushirilmoqda...`);
    try {
      await runCmd('cd /root/savedvideo && npm run install:all || npm install', 60000);
      const ok = await restartProcess(serviceName, true);
      recordHealingAction(`Missing module in ${serviceName}`, 'Missing npm dependency', 'npm install & restart', ok);
      return { diagnosed: true, action: `Yetishmayotgan paketlar o'rnatildi va ${serviceName} qayta ishga tushirildi`, success: ok };
    } catch (npmErr) {
      return { diagnosed: true, action: `npm install xatosi: ${npmErr.message}`, success: false };
    }
  }

  // Ssenariy 4: Disk to'lib ketgan / ENOSPC
  if (err.includes('enospc') || err.includes('no space left') || err.includes('disk full')) {
    console.log(`[AI Doctor] Ssenariy: Disk to'ldi. Favqulodda tozalash...`);
    const { totalDeleted, totalFreedMB } = await performDeepClean();
    const ok = await restartProcess(serviceName, true);
    recordHealingAction(`Disk ENOSPC in ${serviceName}`, 'Disk storage exhausted', `deepClean (${totalFreedMB}MB freed)`, ok);
    return { diagnosed: true, action: `Disk tozalandi (${totalFreedMB}MB) va ${serviceName} qayta ishga tushirildi`, success: ok };
  }

  // Ssenariy 5: JSON Baza buzilgan / JSON.parse error
  if (err.includes('unexpected token') || err.includes('json.parse') || err.includes('syntaxerror: unexpected')) {
    console.log(`[AI Doctor] Ssenariy: JSON baza buzilgan. Baza auto-healer ishga tushmoqda...`);
    const { checkAllDatabases } = require('../checks/dbIntegrityCheck');
    const dbs = await checkAllDatabases();
    let healedCount = 0;
    for (const [dbName, info] of dbs) {
      if (!info.valid) {
        await healDatabase(dbName, info.path, info.defaultContent);
        healedCount++;
      }
    }
    const ok = await restartProcess(serviceName, true);
    recordHealingAction(`JSON Corruption in ${serviceName}`, 'Corrupted database file', `healDatabase (${healedCount} fixed)`, ok);
    return { diagnosed: true, action: `${healedCount} ta baza tiklandi va ${serviceName} restart qilindi`, success: ok };
  }

  // Ssenariy 6: yt-dlp / Extractors Outdated
  if (err.includes('yt-dlp') || err.includes('extractor') || err.includes('cannot parse data') || err.includes('sign in to confirm')) {
    console.log(`[AI Doctor] Ssenariy: yt-dlp yangilanishi talab etiladi...`);
    const upRes = await updateYtDlp();
    recordHealingAction(`yt-dlp download failure in ${serviceName}`, 'Outdated extractor', 'updateYtDlp()', upRes.success);
    return { diagnosed: true, action: `yt-dlp yangilandi: ${upRes.success ? 'Muvaffaqiyatli' : upRes.output}`, success: upRes.success };
  }

  // Ssenariy 7: Nginx / Web gateway xatosi
  if (err.includes('502 bad gateway') || err.includes('504 gateway timeout') || err.includes('nginx')) {
    console.log(`[AI Doctor] Ssenariy: 502/504 Nginx xatosi. Nginx va botlarni sinxron qayta yuklash...`);
    await reloadNginx();
    const ok = await restartProcess(serviceName, true);
    recordHealingAction(`502/504 Bad Gateway on ${serviceName}`, 'Nginx proxy mismatch', 'reloadNginx() & restartProcess()', ok);
    return { diagnosed: true, action: `Nginx va ${serviceName} sinxron tiklandi`, success: ok };
  }

  // Standart fallback: Xavfsiz qayta yuklash
  console.log(`[AI Doctor] Standart fallback: ${serviceName} restart qilinmoqda...`);
  const ok = await restartProcess(serviceName);
  recordHealingAction(`General failure in ${serviceName}`, errorMessage.substring(0, 100), 'restartProcess()', ok);
  return { diagnosed: false, action: `${serviceName} qayta yuklandi`, success: ok };
}

module.exports = {
  diagnoseAndHeal,
  diagnoseCodeSyntax,
  recordHealingAction,
  getHealingHistory
};
