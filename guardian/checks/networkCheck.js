'use strict';
const net = require('net');
const axios = require('axios');

// Tarmoq holati — uzilish xabarini bir marta yuborish uchun
let lastNetworkOk = true;
let networkDownSince = null;

/**
 * TCP socket orqali host:port ga ulana olishni tekshiradi
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function tcpCheck(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const done = (ok) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(ok);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
  });
}

/**
 * Internetga ulanish borligini tekshiradi (Cloudflare + Google HTTPS)
 * @returns {Promise<boolean>}
 */
async function checkInternetConnectivity() {
  const checks = [
    tcpCheck('1.1.1.1', 443, 4000),    // Cloudflare HTTPS
    tcpCheck('8.8.8.8', 443, 4000),    // Google HTTPS
    axios.get('https://cloudflare.com', { timeout: 5000, validateStatus: () => true }).then(() => true).catch(() => false),
    axios.get('https://www.google.com', { timeout: 5000, validateStatus: () => true }).then(() => true).catch(() => false),
  ];
  const results = await Promise.all(checks);
  return results.some(r => r === true); // Kamida bittasi ishlasa OK
}

/**
 * Telegram API ga ulanishni tekshiradi
 * @returns {Promise<{ ok: boolean, latencyMs?: number, error?: string }>}
 */
async function checkTelegramApi() {
  const start = Date.now();
  try {
    const res = await axios.get('https://api.telegram.org', {
      timeout: 8000,
      validateStatus: null
    });
    return { ok: res.status < 500, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Barcha tarmoq tekshiruvlarini bajaradi
 * @returns {Promise<{ internet: boolean, telegram: object }>}
 */
async function checkNetwork() {
  const [internet, telegram] = await Promise.all([
    checkInternetConnectivity(),
    checkTelegramApi()
  ]);

  const netLog = internet ? '✓ Internet: OK' : '✗ Internet: UZILGAN!';
  const tgLog = telegram.ok
    ? `✓ Telegram API: ${telegram.latencyMs}ms`
    : `✗ Telegram API: ${telegram.error}`;

  console.log(`[Guardian Network] ${netLog} | ${tgLog}`);

  // Tarmoq holati o'zgarishini kuzatish
  if (!internet && lastNetworkOk) {
    lastNetworkOk = false;
    networkDownSince = Date.now();
  } else if (internet && !lastNetworkOk) {
    const downDuration = Math.round((Date.now() - networkDownSince) / 1000);
    console.log(`[Guardian Network] Internet qayta tiklandi! (${downDuration}s uzilgan edi)`);
    lastNetworkOk = true;
    networkDownSince = null;
  }

  return { internet, telegram, lastNetworkOk };
}

module.exports = { checkNetwork, checkInternetConnectivity, checkTelegramApi };
