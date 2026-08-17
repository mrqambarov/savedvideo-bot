'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         GUARDIAN WATCHDOG — O'Z-O'ZINI TUZATUVCHI TIZIM    ║
 * ║  Barcha servlar, botlar, sayt, internet, SSL ni kuzatadi    ║
 * ║  Xatolik topilsa — o'zi tuzatadi va Telegram xabar yuboradi ║
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

// ─── Harakatlar ───────────────────────────────────────────────────────────────
const { restartProcess, reloadNginx, restartAllProcesses, renewSSL } = require('./actions/restarter');
const { cleanAllTempDirs, trimPm2Logs } = require('./actions/cleaner');
const { sendAlert, sendRecoveryAlert, sendCriticalAlert } = require('./actions/alerter');

// ─── Sozlamalar ───────────────────────────────────────────────────────────────
const CONFIG = {
  // Tekshiriladigan HTTP endpointlar
  httpEndpoints: [
    { name: 'vibeconvert-api',  url: 'http://127.0.0.1:5000/api/health', timeoutMs: 8000 },
    { name: 'movie-api',        url: 'http://127.0.0.1:5001/movies/api/health', timeoutMs: 8000 },
    { name: 'adult-api',        url: 'http://127.0.0.1:5002/health', timeoutMs: 8000 },
    { name: 'website-public',   url: 'https://xitfilm.uz', timeoutMs: 12000 },
  ],

  // PM2 jarayon nomlari
  pm2Processes: ['vibeconvert-bot', 'movie-bot', 'adult-bot'],

  // HTTP endpoint → PM2 jarayon nomi xaritasi
  endpointToPm2: {
    'vibeconvert-api': 'vibeconvert-bot',
    'movie-api':       'movie-bot',
    'adult-api':       'adult-bot',
  },

  // SSL tekshiriladigan domenlar
  sslDomains: ['xitfilm.uz'],

  // Tekshiruv oraliqlari (millisekund)
  intervals: {
    quick:   30 * 1000,         // 30 soniya: PM2 + HTTP tekshiruv
    network: 2  * 60 * 1000,    // 2 daqiqa: internet + Telegram API
    resource:60 * 60 * 1000,    // 1 soat: disk + RAM + temp tozalash
    ssl:     6  * 60 * 60 * 1000, // 6 soat: SSL sertifikat
  },

  // Ketma-ket qancha marta muvaffaqiyatsiz bo'lsa qayta tiklash kerak
  failThreshold: 2,

  // RAM kritik chegarasi (%)
  ramCritPct: 90,
  diskCritPct: 90,
};

// ─── Holat kuzatuvi ───────────────────────────────────────────────────────────
// Har bir tekshiruv uchun ketma-ket muvaffaqiyatsiz sonini kuzatamiz
const failureCounts = new Map(); // key => count

function recordSuccess(key) { failureCounts.set(key, 0); }
function recordFailure(key) {
  const count = (failureCounts.get(key) || 0) + 1;
  failureCounts.set(key, count);
  return count;
}
function getFailureCount(key) { return failureCounts.get(key) || 0; }

// ─── Asosiy tekshiruv tsikllari ───────────────────────────────────────────────

/**
 * TEZKOR TSIKL (har 30 soniya)
 * PM2 holati + HTTP health tekshiruvi
 */
async function quickCycle() {
  console.log('\n[Guardian] ─── Tezkor tekshiruv boshlandi ───');

  // 1. PM2 jarayonlarini tekshirish
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

  // 2. HTTP endpointlarini tekshirish
  const httpResults = await checkAllEndpoints(CONFIG.httpEndpoints);
  for (const [name, result] of httpResults) {
    if (!result.ok) {
      const count = recordFailure(`http_${name}`);

      if (name === 'website-public') {
        // Sayt javoب bermasa — nginx ni tekshiramiz
        if (count >= CONFIG.failThreshold) {
          console.warn(`[Guardian] Sayt javoб bermadi (${count}x) — nginx reload...`);
          await sendAlert(
            `⚠️ <b>Sayt (xitfilm.uz) javoб bermayapti</b>\n• Xatolik: ${result.error}\n• Nginx qayta yuklanmoqda...`,
            'website_down', 'warn'
          );
          await reloadNginx();
          recordSuccess(`http_${name}`);
        }
      } else {
        // API endpointida muammo → tegishli PM2 jarayonni restart
        const pm2Name = CONFIG.endpointToPm2[name];
        if (pm2Name && count >= CONFIG.failThreshold) {
          console.warn(`[Guardian] "${name}" API javoб bermadi (${count}x) → "${pm2Name}" restart...`);
          await restartProcess(pm2Name);
          recordSuccess(`http_${name}`);
        }
      }
    } else {
      // Muvaffaqiyatli — agar avval muvaffaqiyatsiz bo'lgan bo'lsa xabar ber
      const prev = getFailureCount(`http_${name}`);
      if (prev >= CONFIG.failThreshold) {
        await sendAlert(`✅ <b>${name}</b> yana ishlayapti (${result.latencyMs}ms)`, `recovered_${name}`, 'ok');
      }
      recordSuccess(`http_${name}`);
    }
  }
}

/**
 * TARMOQ TSIKLI (har 2 daqiqa)
 * Internet + Telegram API ulanishini tekshiradi
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
        `✅ <b>Internet aloqasi tiklandii!</b>\n` +
        `• ${count} soniya uzilgan edi\n` +
        `• Botlar qayta ulanmoqda...`,
        'internet_restored', 'ok'
      );
      // Tarmoq tiklanganida botlarni qayta ishga tushirish
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
 * RESURS TSIKLI (har 1 soat)
 * Disk, RAM tekshiruvi + temp fayllar tozalash
 */
async function resourceCycle() {
  console.log('\n[Guardian] ─── Resurs tekshiruvi boshlandi ───');
  const { disk, ram } = await checkSystemResources();

  // Disk holatini tekshirish
  if (disk.usedPct >= CONFIG.diskCritPct) {
    await sendAlert(
      `🚨 <b>DISK KRITIK DARAJADA TO'LIQ!</b>\n` +
      `• Ishlatilgan: ${disk.usedGB}GB / ${disk.totalGB}GB (<b>${disk.usedPct}%</b>)\n` +
      `• Temp fayllar tozalanmoqda...`,
      'disk_critical', 'error'
    );
    const { totalDeleted, totalFreedMB } = await cleanAllTempDirs();
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
    await cleanAllTempDirs(); // Ogohlantirishda ham tozalash
  } else {
    // Odatiy tozalash — temp eski fayllar
    await cleanAllTempDirs();
  }

  // RAM holatini tekshirish
  if (ram.usedPct >= CONFIG.ramCritPct) {
    await sendAlert(
      `🚨 <b>RAM KRITIK DARAJADA TO'LIQ!</b>\n` +
      `• Ishlatilgan: ${ram.usedGB}GB / ${ram.totalGB}GB (<b>${ram.usedPct}%</b>)\n` +
      `• Barcha jarayonlar restart qilinmoqda...`,
      'ram_critical', 'error'
    );
    await restartAllProcesses();
  } else if (!ram.ok) {
    await sendAlert(
      `⚠️ <b>RAM yuqori:</b> ${ram.usedGB}GB / ${ram.totalGB}GB (${ram.usedPct}%)`,
      'ram_warning', 'warn'
    );
  }
}

/**
 * SSL TSIKLI (har 6 soat)
 * SSL sertifikat muddatini tekshiradi
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
        `• Tugash sanasi: ${result.expiresOn}\n• Yangilanmoqda...`,
        `ssl_critical_${domain}`, 'error'
      );
      await renewSSL();
    } else if (result.warn) {
      await sendAlert(
        `⚠️ <b>SSL sertifikat muddati yaqinlashmoqda:</b>\n` +
        `• Domen: ${domain}\n• Qolgan kun: <b>${result.daysLeft} kun</b>\n` +
        `• Tugash sanasi: ${result.expiresOn}`,
        `ssl_warn_${domain}`, 'warn'
      );
    }
  }
}

// ─── Xavfsiz tsikl ishga tushiruvchi ─────────────────────────────────────────

async function runSafely(cycleName, cycleFn) {
  try {
    await cycleFn();
  } catch (err) {
    console.error(`[Guardian] "${cycleName}" tsiklida kutilmagan xato:`, err.message, err.stack);
    try {
      await sendAlert(
        `⚠️ Guardian ichida xato:\n<code>${cycleName}: ${err.message}</code>`,
        `guardian_internal_${cycleName}`, 'warn'
      );
    } catch (_) {}
  }
}

// ─── Ishga tushirish ──────────────────────────────────────────────────────────

async function start() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       GUARDIAN WATCHDOG ishga tushdi!            ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // Dastlabki tekshiruvlar (ishga tushgandan 10s so'ng)
  setTimeout(async () => {
    await runSafely('quickCycle-init', quickCycle);
    await runSafely('networkCycle-init', networkCycle);
    await runSafely('resourceCycle-init', resourceCycle);
    await runSafely('sslCycle-init', sslCycle);

    await sendAlert(
      `🛡️ <b>Guardian Watchdog ishga tushdi</b>\n\n` +
      `✅ Barcha dastlabki tekshiruvlar bajarildi\n` +
      `• Tezkor tekshiruv: har ${CONFIG.intervals.quick / 1000}s\n` +
      `• Tarmoq tekshiruvi: har ${CONFIG.intervals.network / 60000} daqiqa\n` +
      `• Resurs tekshiruvi: har 1 soat\n` +
      `• SSL tekshiruvi: har 6 soat`,
      'guardian_started',
      'ok'
    );
  }, 10000);

  // Muntazam tekshiruv tsikllari
  setInterval(() => runSafely('quickCycle', quickCycle),       CONFIG.intervals.quick);
  setInterval(() => runSafely('networkCycle', networkCycle),   CONFIG.intervals.network);
  setInterval(() => runSafely('resourceCycle', resourceCycle), CONFIG.intervals.resource);
  setInterval(() => runSafely('sslCycle', sslCycle),           CONFIG.intervals.ssl);

  // Jarayon xatolarini ushlash
  process.on('uncaughtException', async (err) => {
    console.error('[Guardian] UncaughtException:', err.message, err.stack);
    try {
      await sendCriticalAlert('Guardian UncaughtException', err.message);
    } catch (_) {}
  });

  process.on('unhandledRejection', async (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error('[Guardian] UnhandledRejection:', msg);
    try {
      await sendAlert(`⚠️ Guardian UnhandledRejection:\n<code>${msg}</code>`, 'unhandled_rejection', 'warn');
    } catch (_) {}
  });

  console.log('[Guardian] Barcha tekshiruv tsikllari sozlandi. Monitoring boshlandi...');
}

start();
