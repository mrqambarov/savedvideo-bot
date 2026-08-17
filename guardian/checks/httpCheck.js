'use strict';
const axios = require('axios');

/**
 * HTTP endpoint ga so'rov yuboradi va salomatligini tekshiradi
 * @param {object} config
 * @param {string} config.name - Servis nomi
 * @param {string} config.url - Tekshiriladigan URL
 * @param {number} [config.timeoutMs=8000] - Kutish vaqti
 * @param {number} [config.expectedStatus=200] - Kutilgan HTTP status
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, latencyMs?: number }>}
 */
async function httpCheck({ name, url, timeoutMs = 8000, expectedStatus = 200 }) {
  const start = Date.now();
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      validateStatus: null, // Barcha statuslarni qabul qilish
      headers: { 'User-Agent': 'Guardian-Watchdog/1.0' }
    });
    const latencyMs = Date.now() - start;

    if (res.status === expectedStatus || res.status < 500) {
      return { ok: true, status: res.status, latencyMs };
    }
    return {
      ok: false,
      status: res.status,
      latencyMs,
      error: `HTTP ${res.status} qaytdi (kutilgan: ${expectedStatus})`
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    let errorMsg = err.message;
    if (err.code === 'ECONNREFUSED') errorMsg = 'Port yopiq yoki process ishlamayapti';
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') errorMsg = `Timeout (${timeoutMs}ms)`;
    if (err.code === 'ENOTFOUND') errorMsg = 'Host topilmadi (DNS xatosi)';

    return { ok: false, latencyMs, error: errorMsg };
  }
}

/**
 * Bir nechta endpointlarni tekshiradi
 * @param {Array} endpoints - httpCheck config obyektlari massivi
 * @returns {Promise<Map<string, object>>} - name => result
 */
async function checkAllEndpoints(endpoints) {
  const results = new Map();
  await Promise.all(endpoints.map(async (ep) => {
    const result = await httpCheck(ep);
    results.set(ep.name, result);
    const status = result.ok
      ? `✓ ${result.latencyMs}ms`
      : `✗ ${result.error}`;
    console.log(`[Guardian HTTP] ${ep.name}: ${status}`);
  }));
  return results;
}

module.exports = { httpCheck, checkAllEndpoints };
