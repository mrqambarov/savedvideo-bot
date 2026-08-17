'use strict';
const os = require('os');
const { runCmd } = require('../actions/restarter');

const DISK_WARN_PCT = 85;    // %85 dan oshsa ogohlantirish
const DISK_CRIT_PCT = 95;    // %95 dan oshsa kritik
const RAM_WARN_PCT = 85;     // %85 dan oshsa ogohlantirish
const RAM_CRIT_PCT = 95;     // %95 dan oshsa kritik

/**
 * Disk ishlatilishi haqida ma'lumot oladi (Linux df)
 * @returns {Promise<{ totalGB: number, usedGB: number, usedPct: number }>}
 */
async function getDiskUsage() {
  try {
    // df -BG /root → "Filesystem 1G-blocks Used Available Use% Mounted on"
    const output = await runCmd("df -BM /root | awk 'NR==2{print $2,$3,$5}'");
    const parts = output.split(/\s+/);
    const total = parseInt(parts[0]);
    const used = parseInt(parts[1]);
    const pct = parseInt(parts[2]);
    return {
      totalGB: (total / 1024).toFixed(1),
      usedGB: (used / 1024).toFixed(1),
      usedPct: pct,
      ok: pct < DISK_WARN_PCT,
      critical: pct >= DISK_CRIT_PCT
    };
  } catch (err) {
    console.error('[Guardian DiskCheck] Disk tekshiruvida xato:', err.message);
    return { totalGB: '?', usedGB: '?', usedPct: 0, ok: true, critical: false };
  }
}

/**
 * RAM ishlatilishi haqida ma'lumot oladi (os moduli)
 * @returns {{ totalGB: number, usedGB: number, usedPct: number, ok: boolean, critical: boolean }}
 */
function getRamUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedPct = Math.round((used / total) * 100);

  return {
    totalGB: (total / 1e9).toFixed(1),
    usedGB: (used / 1e9).toFixed(1),
    usedPct,
    ok: usedPct < RAM_WARN_PCT,
    critical: usedPct >= RAM_CRIT_PCT
  };
}

/**
 * Disk va RAM holatini tekshiradi va natijani qaytaradi
 */
async function checkSystemResources() {
  const [disk, ram] = await Promise.all([
    getDiskUsage(),
    Promise.resolve(getRamUsage())
  ]);

  const diskLog = disk.ok
    ? `✓ Disk: ${disk.usedGB}GB / ${disk.totalGB}GB (${disk.usedPct}%)`
    : `${disk.critical ? '✗' : '⚠'} Disk: ${disk.usedGB}GB / ${disk.totalGB}GB (${disk.usedPct}%)`;

  const ramLog = ram.ok
    ? `✓ RAM: ${ram.usedGB}GB / ${ram.totalGB}GB (${ram.usedPct}%)`
    : `${ram.critical ? '✗' : '⚠'} RAM: ${ram.usedGB}GB / ${ram.totalGB}GB (${ram.usedPct}%)`;

  console.log(`[Guardian Resources] ${diskLog} | ${ramLog}`);

  return { disk, ram };
}

module.exports = { checkSystemResources, getDiskUsage, getRamUsage, DISK_WARN_PCT, DISK_CRIT_PCT, RAM_WARN_PCT, RAM_CRIT_PCT };
