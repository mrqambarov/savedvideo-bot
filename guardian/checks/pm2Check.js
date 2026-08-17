'use strict';
const { runCmd } = require('../actions/restarter');

/**
 * PM2 jarayonlari ro'yxatini JSON formatda oladi
 * @returns {Promise<Array>} - PM2 jarayon obyektlari
 */
async function getPm2List() {
  try {
    const output = await runCmd('pm2 jlist');
    return JSON.parse(output);
  } catch (err) {
    console.error('[Guardian PM2Check] pm2 jlist xatosi:', err.message);
    return [];
  }
}

/**
 * Belgilangan PM2 jarayonlarni tekshiradi
 * @param {Array<string>} processNames - Tekshiriladigan jarayon nomlari
 * @returns {Promise<Map<string, object>>} - name => { ok, status, pm2_status, restarts, memory }
 */
async function checkPm2Processes(processNames) {
  const results = new Map();
  const list = await getPm2List();

  for (const name of processNames) {
    const proc = list.find(p => p.name === name);
    if (!proc) {
      results.set(name, { ok: false, error: 'PM2 da topilmadi' });
      console.warn(`[Guardian PM2Check] "${name}" PM2 da topilmadi!`);
      continue;
    }

    const pm2Status = proc.pm2_env?.status;
    const restarts = proc.pm2_env?.restart_time || 0;
    const memMb = proc.monit ? parseFloat((proc.monit.memory / 1024 / 1024).toFixed(1)) : 0;
    const isOk = pm2Status === 'online';

    results.set(name, {
      ok: isOk,
      pm2Status,
      restarts,
      memMb,
      pid: proc.pid,
      error: isOk ? null : `PM2 holati: "${pm2Status}"`
    });

    const statusStr = isOk
      ? `✓ online | RAM: ${memMb}MB | restarts: ${restarts}`
      : `✗ ${pm2Status} | restarts: ${restarts}`;
    console.log(`[Guardian PM2Check] ${name}: ${statusStr}`);
  }

  return results;
}

module.exports = { checkPm2Processes, getPm2List };
