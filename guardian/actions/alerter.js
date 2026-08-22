'use strict';
const path = require('path');
module.paths.push(
  path.join(__dirname, '..', '..', 'server', 'node_modules'),
  path.join(__dirname, '..', '..', 'movie-server', 'node_modules'),
  path.join(__dirname, '..', '..', 'node_modules')
);
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || process.env.ADMIN_ID || '6263659922')
  .split(',').map(s => s.trim()).filter(Boolean);

// Oxirgi yuborilgan xabarlarni kuzatish (spam oldini olish uchun)
const recentAlerts = new Map(); // key => lastSentTimestamp
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // bir xil xabarni 10 daqiqada bir marta

/**
 * Telegram orqali adminga xabar yuboradi
 * @param {string} text - Xabar matni (HTML)
 * @param {string} [dedupKey] - Takrorlanishni oldini olish uchun kalit
 * @param {'info'|'warn'|'error'|'ok'} [level='info'] - Daraja
 * @param {object} [replyMarkup] - InlineKeyboard tugmalari
 */
async function sendAlert(text, dedupKey = null, level = 'info', replyMarkup = null) {
  if (!BOT_TOKEN) {
    console.warn('[Guardian Alerter] TELEGRAM_BOT_TOKEN mavjud emas, xabar yuborilmadi.');
    return;
  }

  // Spam tekshiruvi
  if (dedupKey) {
    const lastSent = recentAlerts.get(dedupKey);
    if (lastSent && Date.now() - lastSent < ALERT_COOLDOWN_MS) {
      return; // Hali cooldown davomida, yuborma
    }
    recentAlerts.set(dedupKey, Date.now());
  }

  const icon = { info: 'ℹ️', warn: '⚠️', error: '🔴', ok: '✅' }[level] || 'ℹ️';
  const now = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', hour12: false });
  const fullText = `${icon} <b>GUARDIAN PRO</b>\n\n${text}\n\n<i>🕐 ${now}</i>`;

  for (const adminId of ADMIN_IDS) {
    try {
      const payload = {
        chat_id: adminId,
        text: fullText,
        parse_mode: 'HTML'
      };
      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        payload,
        { timeout: 10000 }
      );
    } catch (err) {
      console.error(`[Guardian Alerter] Xabar yuborishda xato (${adminId}): ${err.message}`);
    }
  }
}

/**
 * Faylni (masalan ZIP zaxira) adminga yuboradi
 * @param {string} filePath
 * @param {string} caption
 */
async function sendDocumentToAdmin(filePath, caption = '') {
  if (!BOT_TOKEN || !fs.existsSync(filePath)) return false;

  for (const adminId of ADMIN_IDS) {
    try {
      const form = new FormData();
      form.append('chat_id', adminId);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('document', fs.createReadStream(filePath));

      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
        form,
        { headers: form.getHeaders(), timeout: 60000 }
      );
    } catch (err) {
      console.error(`[Guardian Alerter] Fayl yuborishda xato (${adminId}):`, err.message);
    }
  }
  return true;
}

/**
 * Tizim qayta tiklangani haqida xabar
 */
async function sendRecoveryAlert(serviceName, action, success) {
  const status = success ? '✅ Muvaffaqiyatli tiklandi' : '❌ Tiklab bo\'lmadi, qo\'lda tekshirilsin!';
  await sendAlert(
    `🔧 <b>Muammo aniqlandi va avtomatik tiklandi:</b>\n\n` +
    `• Servis: <code>${serviceName}</code>\n` +
    `• Harakat: <code>${action}</code>\n` +
    `• Natija: ${status}`,
    `recovery_${serviceName}`,
    success ? 'ok' : 'error'
  );
}

/**
 * Kritik muammo haqida xabar
 */
async function sendCriticalAlert(title, details) {
  await sendAlert(
    `🚨 <b>KRITIK MUAMMO: ${title}</b>\n\n${details}\n\n` +
    `⚡ VPS ga kirish: <code>ssh root@94.237.103.133</code>`,
    `critical_${title}`,
    'error'
  );
}

/**
 * Ertalabki Intellektual Xulosa Hisoboti (Morning Intelligence Digest)
 */
async function sendMorningDigest({ botsOnline, httpLatencies, disk, ram, sslDays, ytdlpVer }) {
  const healthScore = botsOnline === 3 && disk.ok && ram.ok ? '100/100 🟢 (A+)' : '85/100 🟡 (Yaxshi)';

  const text =
    `☀️ <b>ERTALABKI TIZIM XULOSASI VA HISOBOTI</b>\n\n` +
    `🏆 <b>Platforma Salomatlik Bali:</b> <b>${healthScore}</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🤖 <b>Botlar Holati (${botsOnline}/3 onlayn):</b>\n` +
    `• 🎥 SaveMedia (Downloader): <b>Onlayn</b> (${httpLatencies.vibe || 20}ms)\n` +
    `• 🍿 Xit Film (Movie Bot): <b>Onlayn</b> (${httpLatencies.movie || 20}ms)\n` +
    `• 🔞 Adult Bot (18+ Server): <b>Onlayn</b> (${httpLatencies.adult || 20}ms)\n` +
    `• 🌐 Web Cinema (xitfilm.uz): <b>Faol</b>\n\n` +
    `💾 <b>Server Resurslari:</b>\n` +
    `• RAM Xotira: <b>${ram.usedGB} GB / ${ram.totalGB} GB</b> (${ram.usedPct}%)\n` +
    `• SSD Disk: <b>${disk.usedGB} GB / ${disk.totalGB} GB</b> (${disk.usedPct}%)\n` +
    `• SSL Sertifikat: <b>${sslDays} kun qoldi</b>\n` +
    `• yt-dlp Versiyasi: <code>${ytdlpVer || 'Eng so\'nggi'}</code>\n\n` +
    `🛡️ <i>Guardian Pro barcha tizimlarni 24/7 rejimda nazorat qilmoqda.</i>`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🎛 Guardian Boshqaruv Paneli', callback_data: 'guard_dashboard' }],
      [{ text: '💾 Baza Zaxirasini Yuklash (ZIP)', callback_data: 'guard_backup' }]
    ]
  };

  await sendAlert(text, 'morning_digest', 'ok', keyboard);
}

module.exports = {
  sendAlert,
  sendRecoveryAlert,
  sendCriticalAlert,
  sendMorningDigest,
  sendDocumentToAdmin,
  ADMIN_IDS,
  BOT_TOKEN
};
