'use strict';
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ─── Telegram alert yuboruvchi ────────────────────────────────────────────────
// Bot API ga to'g'ridan-to'g'ri HTTP POST (grammy ga bog'liq emas)

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
 */
async function sendAlert(text, dedupKey = null, level = 'info') {
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
  const fullText = `${icon} <b>GUARDIAN TIZIMI</b>\n\n${text}\n\n<i>🕐 ${now}</i>`;

  for (const adminId of ADMIN_IDS) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        { chat_id: adminId, text: fullText, parse_mode: 'HTML' },
        { timeout: 10000 }
      );
    } catch (err) {
      console.error(`[Guardian Alerter] Xabar yuborishda xato (${adminId}): ${err.message}`);
    }
  }
}

/**
 * Tizim qayta tiklangani haqida xabar
 */
async function sendRecoveryAlert(serviceName, action, success) {
  const status = success ? '✅ Muvaffaqiyatli tiklandi' : '❌ Tiklab bo\'lmadi, qo\'lda tekshirilsin!';
  await sendAlert(
    `🔧 <b>Muammo aniqlandi va qayta tiklandi:</b>\n\n` +
    `• Servis: <code>${serviceName}</code>\n` +
    `• Harakat: <code>${action}</code>\n` +
    `• Natija: ${status}`,
    `recovery_${serviceName}`,
    success ? 'ok' : 'error'
  );
}

/**
 * Kritik muammo haqida xabar (tiklib bo'lmadi)
 */
async function sendCriticalAlert(title, details) {
  await sendAlert(
    `🚨 <b>KRITIK MUAMMO: ${title}</b>\n\n${details}\n\n` +
    `⚡ VPS ga kirish: <code>ssh root@94.237.103.133</code>`,
    `critical_${title}`,
    'error'
  );
}

module.exports = { sendAlert, sendRecoveryAlert, sendCriticalAlert };
