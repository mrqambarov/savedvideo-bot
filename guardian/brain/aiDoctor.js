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

const { fetchProcessLogs } = require('../actions/restarter');

/**
 * PM2 va Log fayllaridan oxirgi xatoliklarni o'qiydi
 * @param {string} serviceName 
 * @returns {Promise<string>}
 */
async function readProcessCrashLogs(serviceName) {
  let combined = '';
  try {
    // 1. PM2 orqali loglarni olish
    const pm2Logs = await fetchProcessLogs(serviceName, 40);
    combined += `\n${pm2Logs}`;
  } catch (_) {}

  // 2. Logs papkasidagi fayllardan o'qish
  const logFileMap = {
    'vibeconvert-bot': 'vibeconvert-error.log',
    'movie-bot': 'movie-bot-error.log',
    'adult-bot': 'adult-bot-error.log'
  };

  const logFileName = logFileMap[serviceName];
  if (logFileName) {
    const logPath = path.join(BASE_DIR, 'logs', logFileName);
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').slice(-40).join('\n');
        combined += `\n${lines}`;
      } catch (_) {}
    }
  }

  return combined;
}

/**
 * 2. Aqlli Xatolik Klassifikatori va Avtomatik Davolovchi (AI Doctor Dispatcher)
 * Xatolik matniga qarab to'g'ri tuzatish choralarni avtomatik tanlaydi
 * @param {string} serviceName
 * @param {string} errorMessage
 * @returns {Promise<{ diagnosed: boolean, action: string, success: boolean }>}
 */
async function diagnoseAndHeal(serviceName, errorMessage = '') {
  let fullErrorContext = errorMessage || '';

  // Agar xatolik matni qisqa bo'lsa, log fayllaridan chuqur o'qish
  if (fullErrorContext.length < 50 || fullErrorContext.includes('down') || fullErrorContext.includes('failure')) {
    const crashLogs = await readProcessCrashLogs(serviceName);
    fullErrorContext += `\n${crashLogs}`;
  }

  const err = fullErrorContext.toLowerCase();
  console.log(`[AI Doctor] Diagnostika: [${serviceName}] -> Tahlil qilinmoqda (${fullErrorContext.length} belgili log)...`);

  let rootCause = 'Noma\'lum xatolik / jarayon to\'xtashi';
  let actionTaken = 'Standart qayta ishga tushirish';
  let success = false;
  let diagnosed = false;

  // Ssenariy 1: Port band / EADDRINUSE
  if (err.includes('eaddrinuse') || err.includes('address already in use') || err.includes('bind')) {
    diagnosed = true;
    const portMap = { 'vibeconvert-bot': 5000, 'movie-bot': 5001, 'adult-bot': 5002 };
    const port = portMap[serviceName] || 5000;
    rootCause = `Port :${port} boshqa zombi jarayon tomonidan band qilingan (EADDRINUSE)`;
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Port tozalash va restart...`);
    await freePortIfOccupied(port);
    success = await restartProcess(serviceName, true);
    actionTaken = `Port :${port} bo'shatildi va ${serviceName} qayta ishga tushirildi`;
  }

  // Ssenariy 2: Telegram Webhook / 409 Conflict
  else if (err.includes('409') || err.includes('conflict') || err.includes('getupdates') || err.includes('webhook')) {
    diagnosed = true;
    rootCause = 'Telegram 409 Conflict (Boshqa joyda ochiq qolgan polling yoki eski webhook)';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Webhook tozalash va restart...`);
    success = await restartProcess(serviceName, true);
    actionTaken = `Webhook to'liq tozalandi va ${serviceName} polling rejimiga qayta ulandi`;
  }

  // Ssenariy 3: Telegram Rate Limit / 429 Too Many Requests
  else if (err.includes('429') || err.includes('too many requests') || err.includes('retry after')) {
    diagnosed = true;
    rootCause = 'Telegram API Rate Limit (429 Too Many Requests - spam himoyasi)';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Cooldown qo'llanilmoqda...`);
    await new Promise(r => setTimeout(r, 10000));
    success = await restartProcess(serviceName, true);
    actionTaken = `10 soniya cooldown berildi va ${serviceName} qayta yoqildi`;
  }

  // Ssenariy 4: Missing Node Package / MODULE_NOT_FOUND
  else if (err.includes('cannot find module') || err.includes('module_not_found')) {
    diagnosed = true;
    rootCause = 'Yetishmayotgan Node.js paketi (MODULE_NOT_FOUND)';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. npm install ishga tushirilmoqda...`);
    try {
      if (process.platform !== 'win32') {
        await runCmd('cd /root/savedvideo && npm run install:all || npm install', 60000);
      }
      success = await restartProcess(serviceName, true);
      actionTaken = `npm paketlar o'rnatildi va ${serviceName} qayta yoqildi`;
    } catch (npmErr) {
      actionTaken = `npm install muvaffaqiyatsiz: ${npmErr.message}`;
    }
  }

  // Ssenariy 5: Disk to'lib ketgan / ENOSPC
  else if (err.includes('enospc') || err.includes('no space left') || err.includes('disk full')) {
    diagnosed = true;
    rootCause = 'Server diski to\'lib qolgan (ENOSPC)';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Favqulodda tozalash...`);
    const { totalDeleted, totalFreedMB } = await performDeepClean();
    success = await restartProcess(serviceName, true);
    actionTaken = `Disk tozalandi (${totalFreedMB}MB bo'shatildi) va ${serviceName} qayta yoqildi`;
  }

  // Ssenariy 6: JSON Baza buzilgan / JSON.parse error
  else if (err.includes('unexpected token') || err.includes('json.parse') || err.includes('syntaxerror: unexpected')) {
    diagnosed = true;
    rootCause = 'Baza JSON fayli buzilgan (JSON.parse SyntaxError)';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Baza auto-healer ishga tushmoqda...`);
    const { checkAllDatabases } = require('../checks/dbIntegrityCheck');
    const dbs = await checkAllDatabases();
    let healedCount = 0;
    for (const [dbName, info] of dbs) {
      if (!info.valid) {
        await healDatabase(dbName, info.path, info.defaultContent);
        healedCount++;
      }
    }
    success = await restartProcess(serviceName, true);
    actionTaken = `${healedCount} ta buzilgan baza zaxiradan tiklandi va ${serviceName} qayta yoqildi`;
  }

  // Ssenariy 7: RAM Heap out of memory / Memory leak
  else if (err.includes('heap out of memory') || err.includes('allocation failed') || err.includes('javascript heap')) {
    diagnosed = true;
    rootCause = 'Xotira toshib ketishi (JavaScript Heap Out of Memory)';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Kesh tozalash va restart...`);
    await performDeepClean();
    success = await restartProcess(serviceName, true);
    actionTaken = `Xotira bo'shatildi va ${serviceName} yangi xotira bilan qayta yoqildi`;
  }

  // Ssenariy 8: yt-dlp / Extractors Outdated
  else if (err.includes('yt-dlp') || err.includes('extractor') || err.includes('cannot parse data') || err.includes('sign in to confirm')) {
    diagnosed = true;
    rootCause = 'yt-dlp video ekstraktori eskirgan yoki platforma tomonidan bloklangan';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Yangilanish amalga oshirilmoqda...`);
    const upRes = await updateYtDlp();
    actionTaken = `yt-dlp yangilandi (${upRes.success ? 'OK' : 'Xato'})`;
    success = upRes.success;
  }

  // Ssenariy 9: Nginx / Web gateway xatosi
  else if (err.includes('502 bad gateway') || err.includes('504 gateway timeout') || err.includes('nginx')) {
    diagnosed = true;
    rootCause = 'Nginx 502/504 Gateway javob bermasligi';
    console.log(`[AI Doctor] Ssenariy: ${rootCause}. Nginx va botlarni sinxron tiklash...`);
    await reloadNginx();
    success = await restartProcess(serviceName, true);
    actionTaken = `Nginx va ${serviceName} sinxron tiklandi`;
  }

  // Standart fallback
  else {
    console.log(`[AI Doctor] Standart fallback: ${serviceName} qayta ishga tushirilmoqda...`);
    success = await restartProcess(serviceName);
    actionTaken = `${serviceName} qayta yuklandi`;
  }

  // Tarixga yozish
  recordHealingAction(`Crash / Incident on ${serviceName}`, rootCause, actionTaken, success);

  // Adminga chiroyli xabar yuborish
  await sendAlert(
    `🧠 <b>AI DOCTOR — AUTO-HEALING NATIJASI:</b>\n\n` +
    `• Servis: <code>${serviceName}</code>\n` +
    `• Aniqlangan sabab: <b>${rootCause}</b>\n` +
    `• Ko'rilgan chora: <b>${actionTaken}</b>\n` +
    `• Holat: <b>${success ? '✅ Muvaffaqiyatli tiklandi' : '⚠️ Qo\'shimcha tekshiruv zarur'}</b>`,
    `ai_heal_${serviceName}_${Date.now()}`,
    success ? 'ok' : 'warn'
  );

  return { diagnosed, action: actionTaken, success };
}

module.exports = {
  diagnoseAndHeal,
  diagnoseCodeSyntax,
  readProcessCrashLogs,
  recordHealingAction,
  getHealingHistory
};

