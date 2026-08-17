'use strict';
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { runCmd } = require('../actions/restarter');
const { sendAlert } = require('../actions/alerter');

const BASE_DIR = path.join(__dirname, '..', '..');
const isWindows = process.platform === 'win32';
const ytDlpBin = path.join(BASE_DIR, 'server', 'bin', isWindows ? 'yt-dlp.exe' : 'yt-dlp');

/**
 * yt-dlp va ffmpeg binar fayllarini tekshiradi
 * @returns {Promise<{ ytdlp: object, ffmpeg: object }>}
 */
async function checkDownloaderBinaries() {
  const result = {
    ytdlp: { ok: false, version: null, error: null },
    ffmpeg: { ok: false, version: null, error: null }
  };

  // 1. yt-dlp tekshiruvi
  try {
    if (fs.existsSync(ytDlpBin) && !isWindows) {
      try { fs.chmodSync(ytDlpBin, 0o755); } catch (_) {}
    }
    const binToRun = fs.existsSync(ytDlpBin) ? ytDlpBin : 'yt-dlp';
    const versionOut = await runCmd(`${binToRun} --version`, 10000);
    result.ytdlp = { ok: true, version: versionOut.trim(), binPath: binToRun };
  } catch (err) {
    result.ytdlp = { ok: false, error: err.message };
  }

  // 2. ffmpeg tekshiruvi
  try {
    const ffOut = await runCmd('ffmpeg -version', 10000);
    const firstLine = ffOut.split('\n')[0];
    result.ffmpeg = { ok: true, version: firstLine };
  } catch (err) {
    result.ffmpeg = { ok: false, error: err.message };
  }

  const ytLog = result.ytdlp.ok ? `✓ yt-dlp (${result.ytdlp.version})` : `✗ yt-dlp: ${result.ytdlp.error}`;
  const ffLog = result.ffmpeg.ok ? `✓ ffmpeg` : `✗ ffmpeg: ${result.ffmpeg.error}`;
  console.log(`[Downloader Check] ${ytLog} | ${ffLog}`);

  return result;
}

/**
 * yt-dlp binar faylini eng so'nggi versiyaga yangilaydi (-U)
 * @returns {Promise<{ success: boolean, output: string }>}
 */
async function updateYtDlp() {
  console.log('[Downloader Engine] yt-dlp eng so\'nggi versiyaga yangilanmoqda...');
  try {
    const binToRun = fs.existsSync(ytDlpBin) ? ytDlpBin : 'yt-dlp';
    const output = await runCmd(`${binToRun} -U`, 60000);
    console.log(`[Downloader Engine] yt-dlp update natijasi: ${output}`);

    if (output.includes('Updated') || output.includes('up to date')) {
      await sendAlert(
        `⚡ <b>yt-dlp Yuklash Dvigateli Yangilandi!</b>\n\n<code>${output.substring(0, 300)}</code>`,
        'ytdlp_updated',
        'ok'
      );
    }
    return { success: true, output };
  } catch (err) {
    console.error('[Downloader Engine] yt-dlp yangilashda xato:', err.message);
    return { success: false, output: err.message };
  }
}

/**
 * Zaxira Cobalt API larni tekshiradi
 */
async function checkCobaltEndpoints() {
  const endpoints = [
    'https://api.cobalt.tools/',
    'https://co.wuk.sh/api/json',
    'https://cobalt.stream/'
  ];

  let healthyCount = 0;
  for (const ep of endpoints) {
    try {
      await axios.get(ep, { timeout: 4000, validateStatus: () => true });
      healthyCount++;
    } catch (_) {}
  }
  return { total: endpoints.length, active: healthyCount };
}

module.exports = { checkDownloaderBinaries, updateYtDlp, checkCobaltEndpoints };
