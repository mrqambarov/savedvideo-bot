const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const isWindows = process.platform === 'win32';
const binDir = path.join(__dirname, 'bin');
const localYtDlp = path.join(binDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
const tempDir = path.join(__dirname, 'temp');

/**
 * Dynamically gets the best yt-dlp binary path (ensuring executable permissions on Linux)
 */
function getYtDlpBin() {
  if (fs.existsSync(localYtDlp)) {
    if (!isWindows) {
      try { fs.chmodSync(localYtDlp, 0o755); } catch (e) {}
    }
    return localYtDlp;
  }
  return 'yt-dlp';
}

// Build environment variables with local bin folder in PATH for ffmpeg/ffprobe discovery (append, don't prepend)
const env = { ...process.env };
const pathKey = isWindows ? 'Path' : 'PATH';
env[pathKey] = `${env[pathKey] || ''}${path.delimiter}${binDir}`;

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Simulated real Chrome browser User-Agent to bypass bot filters
const browserHeaders = [
  '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

/**
 * Auto-detects cookies.txt location in either project root or server directory
 */
function getCookiesArgs() {
  const rootCookies = path.join(__dirname, '..', 'cookies.txt');
  const serverCookies = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(rootCookies)) {
    return ['--cookies', rootCookies];
  } else if (fs.existsSync(serverCookies)) {
    return ['--cookies', serverCookies];
  }
  return [];
}

// Player client strategies to bypass YouTube/Instagram VPS datacenter IP blocks
const CLIENT_STRATEGIES = [
  ['--extractor-args', 'youtube:player_client=ios,android,mweb,web;player_skip=webpage'],
  ['--extractor-args', 'youtube:player_client=android,ios'],
  ['--extractor-args', 'youtube:player_client=tv_embedded,mweb'],
  ['--extractor-args', 'youtube:player_client=mweb']
];

const BASE_NET_ARGS = [
  '--retries', '10',
  '--fragment-retries', '10',
  '--socket-timeout', '30',
  '--no-check-certificates',
  '--geo-bypass'
];

/**
 * Fallback download using Cobalt public APIs when yt-dlp is blocked by datacenter IP filters
 */
async function fallbackCobaltDownload(url, outputName, isAudio = false, quality = '720') {
  const cobaltEndpoints = [
    'https://api.cobalt.tools/',
    'https://co.wuk.sh/api/json',
    'https://cobalt.kwippy.com/'
  ];

  for (const endpoint of cobaltEndpoints) {
    try {
      const payload = {
        url: url,
        downloadMode: isAudio ? 'audio' : 'auto',
        videoQuality: quality,
        audioFormat: 'mp3'
      };

      const res = await axios.post(endpoint, payload, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 15000
      });

      const data = res.data;
      let downloadUrl = null;
      if (data) {
        if (typeof data.url === 'string' && data.url) {
          downloadUrl = data.url;
        } else if (Array.isArray(data.picker) && data.picker.length > 0) {
          downloadUrl = data.picker[0].url;
        } else if (data.status === 'redirect' || data.status === 'tunnel') {
          downloadUrl = data.url;
        }
      }

      if (downloadUrl) {
        const ext = isAudio ? '.mp3' : '.mp4';
        const destPath = path.join(tempDir, `${outputName}${ext}`);

        const streamRes = await axios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'stream',
          timeout: 90000
        });

        const writer = fs.createWriteStream(destPath);
        streamRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          return destPath;
        }
      }
    } catch (e) {
      // Continue to next mirror endpoint
    }
  }
  throw new Error('Fallback download services exhausted.');
}

/**
 * Get video metadata from a URL
 * @param {string} url 
 * @returns {Promise<object>}
 */
async function getInfo(url) {
  let lastErr = null;
  const cookiesArgs = getCookiesArgs();
  const ytDlpBin = getYtDlpBin();

  for (const strategyArgs of CLIENT_STRATEGIES) {
    try {
      const metadata = await new Promise((resolve, reject) => {
        const args = [
          '--dump-json',
          '--no-playlist',
          '--no-warnings',
          ...BASE_NET_ARGS,
          ...strategyArgs,
          ...cookiesArgs,
          ...browserHeaders,
          url
        ];

        execFile(ytDlpBin, args, { maxBuffer: 20 * 1024 * 1024, env }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message));
          try {
            resolve(JSON.parse(stdout));
          } catch (pErr) {
            reject(new Error('JSON parse error: ' + pErr.message));
          }
        });
      });

      return {
        title: metadata.title,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail || (metadata.thumbnails && metadata.thumbnails.length > 0 ? metadata.thumbnails[metadata.thumbnails.length - 1].url : null),
        artist: metadata.artist || null,
        track: metadata.track || null,
        url: url,
        extractor: metadata.extractor_key || metadata.extractor
      };
    } catch (err) {
      lastErr = err;
    }
  }

  // Basic fallback metadata construct if extractors fail
  return {
    title: 'Media Video',
    duration: 0,
    thumbnail: null,
    artist: null,
    track: null,
    url: url,
    extractor: 'generic'
  };
}

/**
 * Download a video as MP4 with quality selection
 * @param {string} url 
 * @param {string} outputName 
 * @param {'1080' | '720' | '480' | '360'} quality
 * @returns {Promise<string|string[]>} Path to the downloaded video file(s)
 */
async function downloadVideo(url, outputName, quality = '720') {
  const templatePath = path.join(tempDir, `${outputName}.%(ext)s`);
  const targetHeight = parseInt(quality, 10) || 720;
  
  // Prioritize H.264/AAC for speed and native playback, but allow any best stream if needed
  const formatFilter = `bestvideo[height<=${targetHeight}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${targetHeight}]+bestaudio/best[height<=${targetHeight}]/best`;

  const cookiesArgs = getCookiesArgs();
  const ytDlpBin = getYtDlpBin();
  let lastErrMsg = '';

  for (const strategyArgs of CLIENT_STRATEGIES) {
    try {
      const resPath = await new Promise((resolve, reject) => {
        const args = [
          '-f', formatFilter,
          '--merge-output-format', 'mp4',
          '--recode-video', 'mp4',
          '--no-playlist',
          ...BASE_NET_ARGS,
          ...strategyArgs,
          ...cookiesArgs,
          '-o', templatePath,
          ...browserHeaders,
          url
        ];

        execFile(ytDlpBin, args, { env }, (err, stdout, stderr) => {
          const errMsg = stderr || (err ? err.message : '');
          if (err) {
            if (errMsg.includes('No video formats found') || errMsg.includes('Requested format is not available')) {
              return downloadPhoto(url, outputName).then(resolve).catch(() => reject(new Error(errMsg)));
            }
            return reject(new Error(errMsg));
          }

          try {
            const files = fs.readdirSync(tempDir);
            const validFiles = files.filter(f => {
              if (!f.startsWith(outputName)) return false;
              const ext = path.extname(f).toLowerCase();
              if (['.part', '.ytdl', '.tmp', '.temp'].includes(ext)) return false;
              const fullPath = path.join(tempDir, f);
              try {
                return fs.statSync(fullPath).size > 0;
              } catch (e) {
                return false;
              }
            });

            if (validFiles.length > 0) {
              resolve(path.join(tempDir, validFiles[0]));
            } else {
              downloadPhoto(url, outputName).then(resolve).catch(() => reject(new Error('Downloaded media file not found.')));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      if (resPath) return resPath;
    } catch (err) {
      lastErrMsg = err.message || '';
    }
  }

  // Try photo extraction before giving up to Cobalt
  try {
    const photoResult = await downloadPhoto(url, outputName);
    if (photoResult) return photoResult;
  } catch (pErr) {}

  // Fallback to Cobalt API download service if yt-dlp is blocked by IP / bot detection
  console.log('[Downloader] yt-dlp failed on VPS. Invoking Cobalt API fallback...');
  try {
    return await fallbackCobaltDownload(url, outputName, false, quality);
  } catch (fallbackErr) {
    throw new Error(lastErrMsg || fallbackErr.message || 'Media download failed.');
  }
}

/**
 * Download photo/thumbnail when no video format is available
 * @param {string} url 
 * @param {string} outputName 
 * @returns {Promise<string|string[]>}
 */
function downloadPhoto(url, outputName) {
  return new Promise((resolve, reject) => {
    const templatePath = path.join(tempDir, `${outputName}_%(autonumber)s.%(ext)s`);
    const cookiesArgs = getCookiesArgs();
    const ytDlpBin = getYtDlpBin();

    const args = [
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--skip-download',
      '--ignore-no-formats-error',
      ...BASE_NET_ARGS,
      ...CLIENT_STRATEGIES[0],
      ...cookiesArgs,
      '-o', templatePath,
      ...browserHeaders,
      url
    ];

    execFile(ytDlpBin, args, { env }, (err, stdout, stderr) => {
      try {
        const files = fs.readdirSync(tempDir);
        const matched = files.filter(f => f.startsWith(outputName)).sort().map(f => path.join(tempDir, f));
        if (matched.length === 1) {
          resolve(matched[0]);
        } else if (matched.length > 1) {
          resolve(matched);
        } else {
          reject(new Error(stderr || (err ? err.message : 'Photo file not found')));
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Download a video/audio and extract to MP3
 * @param {string} url 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to the downloaded MP3 file
 */
async function downloadAudio(url, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  const cookiesArgs = getCookiesArgs();
  const ytDlpBin = getYtDlpBin();
  let lastErrMsg = '';

  for (const strategyArgs of CLIENT_STRATEGIES) {
    try {
      const resPath = await new Promise((resolve, reject) => {
        const args = [
          '-f', 'ba/best',
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '5',
          '--no-playlist',
          ...BASE_NET_ARGS,
          ...strategyArgs,
          ...cookiesArgs,
          '-o', path.join(tempDir, `${outputName}.%(ext)s`),
          ...browserHeaders,
          url
        ];

        execFile(ytDlpBin, args, { env }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message));
          if (fs.existsSync(outputPath)) {
            resolve(outputPath);
          } else {
            reject(new Error('Downloaded audio file not found at ' + outputPath));
          }
        });
      });

      if (resPath) return resPath;
    } catch (err) {
      lastErrMsg = err.message || '';
    }
  }

  // Fallback to Cobalt API download for audio
  console.log('[Downloader] Audio yt-dlp failed on VPS. Invoking Cobalt API fallback...');
  try {
    return await fallbackCobaltDownload(url, outputName, true);
  } catch (fallbackErr) {
    throw new Error(lastErrMsg || fallbackErr.message || 'Audio download failed.');
  }
}

/**
 * Searches YouTube for a query and returns top results metadata (flat playlist)
 * @param {string} query 
 * @param {number} limit 
 * @returns {Promise<Array<object>>}
 */
function searchMusic(query, limit = 10) {
  return new Promise((resolve, reject) => {
    const searchTarget = `ytsearch${limit}:${query}`;
    const cookiesArgs = getCookiesArgs();
    const ytDlpBin = getYtDlpBin();

    const args = [
      '--flat-playlist',
      '--dump-json',
      '--no-playlist',
      ...BASE_NET_ARGS,
      ...CLIENT_STRATEGIES[0],
      ...cookiesArgs,
      ...browserHeaders,
      searchTarget
    ];

    execFile(ytDlpBin, args, { maxBuffer: 15 * 1024 * 1024, env }, (err, stdout, stderr) => {
      if (err && !stdout) {
        return reject(new Error(stderr || err.message));
      }

      const results = [];
      const lines = (stdout || '').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          results.push({
            title: item.title,
            id: item.id,
            duration: item.duration || 0,
            url: `https://www.youtube.com/watch?v=${item.id}`
          });
        } catch (e) {}
      }
      resolve(results);
    });
  });
}

module.exports = {
  getInfo,
  downloadVideo,
  downloadAudio,
  searchMusic,
  tempDir
};
