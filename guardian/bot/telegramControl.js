'use strict';
const { restartProcess, reloadNginx, restartAllProcesses, fetchProcessLogs } = require('../actions/restarter');
const { performDeepClean, createFullBackupZip } = require('../actions/cleaner');
const { checkSystemResources } = require('../checks/diskCheck');
const { checkDownloaderBinaries, updateYtDlp } = require('../checks/downloaderCheck');
const { checkAllSSL } = require('../checks/sslCheck');
const { checkAllEndpoints } = require('../checks/httpCheck');
const { checkPm2Processes } = require('../checks/pm2Check');
const { sendDocumentToAdmin, ADMIN_IDS } = require('../actions/alerter');
const fs = require('fs');

function isAuthorizedAdmin(userId) {
  if (!userId) return false;
  return ADMIN_IDS.includes(String(userId)) || String(userId) === '6263659922';
}

/**
 * Guardian Interaktiv Boshqaruv Dashboard matni va tugmalarini qaytaradi
 */
async function getGuardianDashboardData() {
  const pm2Results = await checkPm2Processes(['vibeconvert-bot', 'movie-bot', 'adult-bot', 'guardian']);
  const { disk, ram } = await checkSystemResources();
  const dlCheck = await checkDownloaderBinaries();

  let botStatusText = '';
  for (const [name, res] of pm2Results) {
    const icon = res.ok ? '🟢' : '🔴';
    botStatusText += `${icon} <b>${name}</b>: ${res.ok ? `Online (${res.memMb}MB)` : 'Offline'}\n`;
  }

  const text =
    `🛡️ <b>GUARDIAN PRO — ENTERPRISE BOSHQARUV PANELI</b>\n\n` +
    `📊 <b>PM2 Jarayonlari:</b>\n${botStatusText}\n` +
    `💾 <b>Resurslar:</b>\n` +
    `• RAM: <b>${ram.usedGB}GB / ${ram.totalGB}GB</b> (${ram.usedPct}%)\n` +
    `• SSD Disk: <b>${disk.usedGB}GB / ${disk.totalGB}GB</b> (${disk.usedPct}%)\n` +
    `• yt-dlp: <code>${dlCheck.ytdlp.version || 'Eng so\'nggi'}</code>\n\n` +
    `👇 <b>Kerakli amaliyotni tanlang:</b>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Downloader Bot', callback_data: 'guard_rst:vibeconvert-bot' },
        { text: '🍿 Kino Bot', callback_data: 'guard_rst:movie-bot' }
      ],
      [
        { text: '🔞 Adult Bot', callback_data: 'guard_rst:adult-bot' },
        { text: '🌐 Nginx Sayt', callback_data: 'guard_rst_nginx' }
      ],
      [
        { text: '⚡ Barchasini Qayta Yuklash', callback_data: 'guard_rst_all' }
      ],
      [
        { text: '📜 Loglarni Ko\'rish', callback_data: 'guard_logs:vibeconvert-bot' },
        { text: '🧹 Chuqur Tozalash', callback_data: 'guard_deep_clean' }
      ],
      [
        { text: '💾 Baza Zaxirasini Olish (ZIP)', callback_data: 'guard_backup' },
        { text: '🚀 yt-dlp Yangilash', callback_data: 'guard_ytdlp_update' }
      ],
      [
        { text: '🔄 Panelni Yangilash', callback_data: 'guard_dashboard' }
      ]
    ]
  };

  return { text, keyboard };
}

/**
 * Guardian callback so'rovlarini qayta ishlovchi markaziy funksiya
 */
async function handleGuardianCallback(action, userId) {
  if (!isAuthorizedAdmin(userId)) {
    return { text: '⚠️ Sizda ushbu amaliyotni bajarish huquqi yo\'q.' };
  }

  // 1. Dashboard
  if (action === 'guard_dashboard') {
    return await getGuardianDashboardData();
  }

  // 2. Restart specific bot
  if (action.startsWith('guard_rst:')) {
    const procName = action.split(':')[1];
    await restartProcess(procName, true);
    return {
      alertText: `✅ "${procName}" muvaffaqiyatli qayta yuklandi!`,
      refreshDashboard: true
    };
  }

  // 3. Restart Nginx
  if (action === 'guard_rst_nginx') {
    await reloadNginx();
    return {
      alertText: `✅ Nginx va Web sayt qayta yuklandi!`,
      refreshDashboard: true
    };
  }

  // 4. Restart All
  if (action === 'guard_rst_all') {
    await restartAllProcesses();
    return {
      alertText: `⚡ Barcha jarayonlar to'liq qayta yuklandi!`,
      refreshDashboard: true
    };
  }

  // 5. Deep Clean
  if (action === 'guard_deep_clean') {
    const { totalDeleted, totalFreedMB } = await performDeepClean();
    return {
      alertText: `🧹 Tozalandi: ${totalDeleted} ta fayl (${totalFreedMB}MB bo'shatildi)`,
      refreshDashboard: true
    };
  }

  // 6. yt-dlp Update
  if (action === 'guard_ytdlp_update') {
    const res = await updateYtDlp();
    return {
      alertText: res.success ? `⚡ yt-dlp yangilandi!` : `Xatolik: ${res.output}`,
      refreshDashboard: true
    };
  }

  // 7. Instant Backup ZIP
  if (action === 'guard_backup') {
    const zipPath = await createFullBackupZip();
    if (zipPath && fs.existsSync(zipPath)) {
      await sendDocumentToAdmin(zipPath, `📦 <b>Instant Database Backup (${new Date().toISOString().split('T')[0]})</b>\n💾 Barcha botlar va bazalar zaxirasi`);
      try { fs.unlinkSync(zipPath); } catch (_) {}
      return { alertText: `✅ Baza zaxira nusxasi (ZIP) chatga yuborildi!` };
    } else {
      return { alertText: `❌ Zaxira fayl yaratishda xatolik.` };
    }
  }

  // 8. View Process Logs
  if (action.startsWith('guard_logs:')) {
    const procName = action.split(':')[1] || 'vibeconvert-bot';
    const logs = await fetchProcessLogs(procName, 15);
    return {
      text: `📜 <b>"${procName}" oxirgi 15 qator loglari:</b>\n\n<pre>${logs.substring(0, 3500)}</pre>`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔄 Loglarni Yangilash', callback_data: `guard_logs:${procName}` }],
          [{ text: '🔙 Boshqaruv Paneliga Qaytish', callback_data: 'guard_dashboard' }]
        ]
      }
    };
  }

  return { text: 'Noma\'lum buyruq' };
}

module.exports = {
  getGuardianDashboardData,
  handleGuardianCallback,
  isAuthorizedAdmin
};
