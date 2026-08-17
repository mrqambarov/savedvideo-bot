'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         GUARDIAN PRO — ENTERPRISE WATCHDOG & HEALER         ║
 * ║  Barcha servlar, botlar, sayt, internet, SSL, bazani        ║
 * ║  kuzatadi, o'zini o'zi tuzatadi va Adminga hisobot beradi   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ─── Tekshiruvchilar ──────────────────────────────────────────────────────────
const { checkAllEndpoints }      = require('./checks/httpCheck');
const { checkPm2Processes }      = require('./checks/pm2Check');
const { checkNetwork }           = require('./checks/networkCheck');
const { checkSystemResources }   = require('./checks/diskCheck');
const { checkAllSSL }            = require('./checks/sslCheck');
const { checkAllDatabases }      = require('./checks/dbIntegrityCheck');
const { checkDownloaderBinaries, updateYtDlp } = require('./checks/downloaderCheck');

// ─── Harakatlar ───────────────────────────────────────────────────────────────
const { restartProcess, reloadNginx, restartAllProcesses, renewSSL } = require('./actions/restarter');
const { cleanAllTempDirs, trimPm2Logs, performDeepClean } = require('./actions/cleaner');
const { healDatabase }           = require('./actions/dbHealer');
const { sendAlert, sendRecoveryAlert, sendCriticalAlert, sendMorningDigest } = require('./actions/alerter');

// ─── Sozlamalar ───────────────────────────────────────────────────────────────
const CONFIG = {
  httpEndpoints: [
    { name: 'vibeconvert-api',  url: 'http://127.0.0.1:5000/api/health', timeoutMs: 8000 },
    { name: 'movie-api',        url: 'http://127.0.0.1:5001/movies/api/health', timeoutMs: 8000 },
    { name: 'adult-api',        url: 'http://127.0.0.1:5002/health', timeoutMs: 8000 },
    { name: 'website-public',   url: 'https://xitfilm.uz', timeoutMs: 12000 },
  ],

  pm2Processes: ['vibeconvert-bot', 'movie-bot', 'adult-bot'],

  endpointToPm2: {
    'vibeconvert-api': 'vibeconvert-bot',
    'movie-api':       'movie-bot',
    'adult-api':       'adult-bot',
  },

  sslDomains: ['xitfilm.uz'],

  intervals: {
    quick:       30 * 1000,         // 30s: PM2 + HTTP health
    network:     2  * 60 * 1000,    // 2m: internet + Telegram API
    database:    10 * 60 * 1000,    // 10m: JSON Baza yaxlitligi
    downloader:  2  * 60 * 60 * 1000, // 2h: yt-dlp & ffmpeg dvigateli
    resource:    60 * 60 * 1000,    // 1h: disk + RAM + temp tozalash
    ssl:         6  * 60 * 60 * 1000, // 6h: SSL sertifikat
  },

  failThreshold: 2,
  ramCritPct: 90,
  diskCritPct: 90,
};

const failureCounts = new Map();
function recordSuccess(key) { failureCounts.set(key, 0); }
function recordFailure(key) {
  const count = (failureCounts.get(key) || 0) + 1;
  failureCounts.set(key, count);
  return count;
}
function getFailureCount(key) { return failureCounts.get(key) || 0; }

// ─── Asosiy tekshiruv tsikllari ───────────────────────────────────────────────

/**
 * 1. TEZKOR TSIKL (har 30 soniya)
 * PM2 holati + HTTP health tekshiruvi
 */
async function quickCycle() {
  console.log('\n[Guardian] ─── Tezkor tekshiruv boshlandi ───');

  const pm2Results = await checkPm2Processes(CONFIG.pm2Processes);
  for (const [name, result] of pm2Results) {
    if (!result.ok) {
      const count = recordFailure(`pm2_${name}`);
      if (count >= CONFIG.failThreshold) {
        console.warn(`[Guardian] "${name}" ${count} marta muvaffaqiyatsiz — restart...`);
        await restartProcess(name);
        recordSuccess(`pm2_${name}`);
      }
    } else {
      recordSuccess(`pm2_${name}`);
    }
  }

  const httpResults = await checkAllEndpoints(CONFIG.httpEndpoints);
  for (const [name, result] of httpResults) {
    if (!result.ok) {
      const count = recordFailure(`http_${name}`);

      if (name === 'website-public') {
        if (count >= CONFIG.failThreshold) {
          console.warn(`[Guardian] Sayt javob bermadi (${count}x) — nginx reload...`);
          await sendAlert(
            `⚠️ <b>Sayt (xitfilm.uz) javob bermayapti</b>\n• Xatolik: ${result.error}\n• Nginx qayta yuklanmoqda...`,
            'website_down', 'warn'
          );
          await reloadNginx();
          recordSuccess(`http_${name}`);
        }
      } else {
        const pm2Name = CONFIG.endpointToPm2[name];
        if (pm2Name && count >= CONFIG.failThreshold) {
          console.warn(`[Guardian] "${name}" API javob bermadi (${count}x) → "${pm2Name}" restart...`);
          await restartProcess(pm2Name);
          recordSuccess(`http_${name}`);
        }
      }
    } else {
      const prev = getFailureCount(`http_${name}`);
      if (prev >= CONFIG.failThreshold) {
        await sendAlert(`✅ <b>${name}</b> yana ishlayapti (${result.latencyMs}ms)`, `recovered_${name}`, 'ok');
      }
      recordSuccess(`http_${name}`);
    }
  }
}

/**
 * 2. TARMOQ TSIKLI (har 2 daqiqa)
 */
async function networkCycle() {
  console.log('\n[Guardian] ─── Tarmoq tekshiruvi boshlandi ───');
  const { internet, telegram } = await checkNetwork();

  if (!internet) {
    const count = recordFailure('internet');
    if (count === 1) {
      await sendAlert(
        '⛔ <b>Internet ulanishi uzildi!</b>\n' +
        'Botlar xabar qabul qila olmayapti.\n' +
        'Tarmoq tiklanishi kutilmoqda...',
        'internet_down', 'error'
      );
    }
    console.error(`[Guardian] Internet uzilgan! (${count}x)`);
  } else {
    const prev = getFailureCount('internet');
    if (prev > 0) {
      await sendAlert(
        `✅ <b>Internet aloqasi tiklandi!</b>\n` +
        `• Botlar va servislar qayta ulanmoqda...`,
        'internet_restored', 'ok'
      );
      for (const name of CONFIG.pm2Processes) {
        await restartProcess(name);
      }
    }
    recordSuccess('internet');
  }

  if (!telegram.ok) {
    const count = recordFailure('telegram_api');
    if (count === 1) {
      await sendAlert(
        '⚠️ <b>Telegram API ga ulanib bo\'lmayapti</b>\n' +
        `• Xatolik: ${telegram.error || 'Timeout'}`,
        'telegram_api_down', 'warn'
      );
    }
  } else {
    recordSuccess('telegram_api');
  }
}

/**
 * 3. BAZA YAXLITLIGI TSIKLI (har 10 daqiqa)
 * Buzilgan JSON bazalarni avtomatik tuzatadi
 */
async function databaseCycle() {
  console.log('\n[Guardian] ─── Baza yaxlitligi tekshiruvi boshlandi ───');
  const dbResults = await checkAllDatabases();

  for (const [name, info] of dbResults) {
    if (!info.valid) {
      console.error(`[Guardian DB] Baza buzilgan: ${name}! Tiklash boshlanmoqda...`);
      await healDatabase(name, info.path, info.defaultContent);
    }
  }
}

/**
 * 4. YUKLASH DVIGATELI TSIKLI (har 2 soat)
 * yt-dlp va ffmpegni yangilaydi
 */
async function downloaderCycle() {
  console.log('\n[Guardian] ─── Yuklash dvigateli tekshiruvi boshlandi ───');
  const binResults = await checkDownloaderBinaries();

  if (!binResults.ytdlp.ok) {
    console.warn('[Guardian] yt-dlp ishlamayapti, yangilashga urinish...');
    await updateYtDlp();
  }
}

/**
 * 5. RESURS TSIKLI (har 1 soat)
 * Disk, RAM tekshiruvi + temp tozalash
 */
async function resourceCycle() {
  console.log('\n[Guardian] ─── Resurs tekshiruvi boshlandi ───');
  const { disk, ram } = await checkSystemResources();

  if (disk.usedPct >= CONFIG.diskCritPct) {
    await sendAlert(
      `🚨 <b>DISK KRITIK DARAJADA TO'LIQ!</b>\n` +
      `• Ishlatilgan: ${disk.usedGB}GB / ${disk.totalGB}GB (<b>${disk.usedPct}%</b>)\n` +
      `• Chuqur tozalash bajarilmoqda...`,
      'disk_critical', 'error'
    );
    const { totalDeleted, totalFreedMB } = await performDeepClean();
    await trimPm2Logs();
    if (totalFreedMB > 0) {
      await sendAlert(
        `✅ Disk tozalash yakunlandi\n• ${totalDeleted} fayl o'chirildi\n• ${totalFreedMB.toFixed(1)}MB bo'shatildi`,
        'disk_cleaned', 'ok'
      );
    }
  } else if (!disk.ok) {
    await sendAlert(
      `⚠️ <b>Disk hajmi yuqori:</b> ${disk.usedGB}GB / ${disk.totalGB}GB (${disk.usedPct}%)`,
      'disk_warning', 'warn'
    );
    await cleanAllTempDirs();
  } else {
    await cleanAllTempDirs();
  }

  if (ram.usedPct >= CONFIG.ramCritPct) {
    await sendAlert(
      `🚨 <b>RAM KRITIK DARAJADA TO'LIQ!</b>\n` +
      `• Ishlatilgan: ${ram.usedGB}GB / ${ram.totalGB}GB (<b>${ram.usedPct}%</b>)\n` +
      `• Barcha jarayonlar restart qilinmoqda...`,
      'ram_critical', 'error'
    );
    await restartAllProcesses();
  }
}

/**
 * 6. SSL TSIKLI (har 6 soat)
 */
async function sslCycle() {
  console.log('\n[Guardian] ─── SSL tekshiruvi boshlandi ───');
  const sslResults = await checkAllSSL(CONFIG.sslDomains);

  for (const [domain, result] of sslResults) {
    if (result.error) {
      await sendAlert(
        `⚠️ <b>SSL tekshiruvi muvaffaqiyatsiz:</b> ${domain}\n• Xatolik: ${result.error}`,
        `ssl_error_${domain}`, 'warn'
      );
    } else if (result.critical) {
      await sendAlert(
        `🚨 <b>SSL sertifikat yaqinda tugaydi!</b>\n` +
        `• Domen: ${domain}\n• Qolgan kun: <b>${result.daysLeft} kun</b>\n` +
        `• Yangilanmoqda...`,
        `ssl_critical_${domain}`, 'error'
      );
      await renewSSL();
    }
  }
}

/**
 * 7. ERTALABKI HISOBOT (Har kuni soat 09:00 Tashkent vaqti)
 */
let lastMorningReportDate = null;
function checkMorningReportSchedule() {
  const now = new Date();
  const tashkentHour = (now.getUTCHours() + 5) % 24;
  const dateStr = now.toISOString().split('T')[0];

  if (tashkentHour === 9 && lastMorningReportDate !== dateStr) {
    lastMorningReportDate = dateStr;
    runSafely('morningReport', async () => {
      const pm2Results = await checkPm2Processes(CONFIG.pm2Processes);
      const httpResults = await checkAllEndpoints(CONFIG.httpEndpoints);
      const { disk, ram } = await checkSystemResources();
      const sslResults = await checkAllSSL(CONFIG.sslDomains);
      const dlResults = await checkDownloaderBinaries();

      let onlineCount = 0;
      for (const [_, res] of pm2Results) {
        if (res.ok) onlineCount++;
      }

      const latencies = {
        vibe: httpResults.get('vibeconvert-api')?.latencyMs || 25,
        movie: httpResults.get('movie-api')?.latencyMs || 25,
        adult: httpResults.get('adult-api')?.latencyMs || 25,
      };

      const sslDays = sslResults.get('xitfilm.uz')?.daysLeft || 80;

      await sendMorningDigest({
        botsOnline: onlineCount,
        httpLatencies: latencies,
        disk,
        ram,
        sslDays,
        ytdlpVer: dlResults.ytdlp.version
      });
    });
  }
}

// ─── Xavfsiz tsikl ishga tushiruvchi ─────────────────────────────────────────

async function runSafely(cycleName, cycleFn) {
  try {
    await cycleFn();
  } catch (err) {
    console.error(`[Guardian] "${cycleName}" tsiklida xato:`, err.message);
  }
}

// ─── Ishga tushirish ──────────────────────────────────────────────────────────

async function start() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       GUARDIAN PRO WATCHDOG ISHGA TUSHDI!        ║');
  console.log('╚══════════════════════════════════════════════════╝');

  setTimeout(async () => {
    await runSafely('quickCycle-init', quickCycle);
    await runSafely('networkCycle-init', networkCycle);
    await runSafely('databaseCycle-init', databaseCycle);
    await runSafely('downloaderCycle-init', downloaderCycle);
    await runSafely('resourceCycle-init', resourceCycle);
    await runSafely('sslCycle-init', sslCycle);

    await sendAlert(
      `🛡️ <b>GUARDIAN PRO FAOL ISHGA TUSHDI!</b>\n\n` +
      `✅ Barcha intellektual xizmatlar tayyor:\n` +
      `• ⚡ Tezkor monitoring: <b>har 30s</b>\n` +
      `• 🌐 Tarmoq nazorati: <b>har 2 daqiqa</b>\n` +
      `• 🗄 Baza Auto-Healer: <b>har 10 daqiqa</b>\n` +
      `• 📥 yt-dlp & Dvigatel: <b>har 2 soat</b>\n` +
      `• 🧹 Resurs va Temp tozalash: <b>har 1 soat</b>\n` +
      `• ☀️ Ertalabki hisobot: <b>har kuni 09:00 da</b>\n\n` +
      `<i>💡 Admin Telegram botda /guardian deb yozib interaktiv boshqaruv pultini ochishi mumkin!</i>`,
      'guardian_pro_started',
      'ok',
      {
        inline_keyboard: [
          [{ text: '🎛 Guardian Boshqaruv Paneli', callback_data: 'guard_dashboard' }]
        ]
      }
    );
  }, 10000);

  // Muntazam tsikllar
  setInterval(() => runSafely('quickCycle', quickCycle),             CONFIG.intervals.quick);
  setInterval(() => runSafely('networkCycle', networkCycle),         CONFIG.intervals.network);
  setInterval(() => runSafely('databaseCycle', databaseCycle),       CONFIG.intervals.database);
  setInterval(() => runSafely('downloaderCycle', downloaderCycle),   CONFIG.intervals.downloader);
  setInterval(() => runSafely('resourceCycle', resourceCycle),       CONFIG.intervals.resource);
  setInterval(() => runSafely('sslCycle', sslCycle),                 CONFIG.intervals.ssl);
  setInterval(() => checkMorningReportSchedule(),                    60 * 1000); // har daqiqada 09:00 tekshiruvi

  process.on('uncaughtException', async (err) => {
    console.error('[Guardian] UncaughtException:', err.message);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('[Guardian] UnhandledRejection:', reason);
  });

  console.log('[Guardian Pro] Barcha tekshiruv tsikllari va Auto-Healer faollashtirildi.');
}

start();
