const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const binDir = path.join(__dirname, 'bin');
const localYtDlp = path.join(binDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
const ytDlpPath = fs.existsSync(localYtDlp) ? localYtDlp : 'yt-dlp';
const tempDir = path.join(__dirname, 'temp');

// Build environment variables with the local bin folder in PATH for ffmpeg/ffprobe discovery
const env = { ...process.env };
const pathKey = isWindows ? 'Path' : 'PATH';
env[pathKey] = `${binDir}${path.delimiter}${env[pathKey] || ''}`;

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Simulated real Chrome browser User-Agent to bypass bot filters
const browserHeaders = [
  '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Network resilience for all yt-dlp calls. Previously used `--retries 0` and
// `--socket-timeout 5`, which made any slow/transient response fail instantly.
// player_client=default lets yt-dlp pick its recommended YouTube clients.
const NET_ARGS = [
  '--retries', '10',
  '--fragment-retries', '10',
  '--socket-timeout', '30',
  '--extractor-args', 'youtube:player_client=default',
];

/**
 * Get video metadata from a URL
 * @param {string} url 
 * @returns {Promise<object>}
 */
function getInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json', 
      '--no-playlist', 
      '--no-warnings', 
      ...NET_ARGS,
      ...browserHeaders
    ];
    const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }
    args.push(url);

    execFile(ytDlpPath, args, { maxBuffer: 20 * 1024 * 1024, env }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      try {
        const metadata = JSON.parse(stdout);
        resolve({
          title: metadata.title,
          duration: metadata.duration,
          thumbnail: metadata.thumbnail || (metadata.thumbnails && metadata.thumbnails.length > 0 ? metadata.thumbnails[metadata.thumbnails.length - 1].url : null),
          artist: metadata.artist || null,
          track: metadata.track || null,
          url: url,
          extractor: metadata.extractor_key || metadata.extractor
        });
      } catch (parseErr) {
        reject(new Error('Failed to parse video metadata: ' + parseErr.message));
      }
    });
  });
}

/**
 * Download a video as MP4 with quality selection
 * @param {string} url 
 * @param {string} outputName 
 * @param {'1080' | '720' | '480' | '360'} quality
 * @returns {Promise<string>} Path to the downloaded video file
 */
function downloadVideo(url, outputName, quality = '720') {
  return new Promise((resolve, reject) => {
    const templatePath = path.join(tempDir, `${outputName}.%(ext)s`);
    let formatFilter = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[ext=mp4]/best';

    if (quality === '1080') {
      formatFilter = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[ext=mp4]/best';
    } else if (quality === '480') {
      formatFilter = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[ext=mp4]/best';
    } else if (quality === '360') {
      formatFilter = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[ext=mp4]/best';
    }

    const args = [
      '-f', formatFilter,
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--geo-bypass',
      ...NET_ARGS,
      '-o', templatePath,
      ...browserHeaders
    ];
    const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }
    args.push(url);

    execFile(ytDlpPath, args, { env }, (err, stdout, stderr) => {
      const errMsg = stderr || (err ? err.message : '');
      if (err) {
        if (errMsg.includes('No video formats found') || errMsg.includes('Requested format is not available')) {
          // Fallback to downloading image/thumbnail
          return downloadPhoto(url, outputName).then(resolve).catch(() => reject(new Error(errMsg)));
        }
        return reject(new Error(errMsg));
      }
      
      // Find the file dynamically because extension is variable
      try {
        const files = fs.readdirSync(tempDir);
        const matched = files.find(f => f.startsWith(outputName));
        if (matched) {
          resolve(path.join(tempDir, matched));
        } else {
          // If no video file was saved, try photo fallback
          downloadPhoto(url, outputName).then(resolve).catch(() => reject(new Error('Downloaded media file not found.')));
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Download photo/thumbnail when no video format is available
 * @param {string} url 
 * @param {string} outputName 
 * @returns {Promise<string>}
 */
function downloadPhoto(url, outputName) {
  return new Promise((resolve, reject) => {
    const templatePath = path.join(tempDir, `${outputName}_%(autonumber)s.%(ext)s`);
    const args = [
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--skip-download',
      '--ignore-no-formats-error',
      ...NET_ARGS,
      '-o', templatePath,
      ...browserHeaders
    ];
    const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }
    args.push(url);

    execFile(ytDlpPath, args, { env }, (err, stdout, stderr) => {
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
function downloadAudio(url, outputName) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(tempDir, `${outputName}.mp3`);
    const args = [
      '-f', 'ba/best', 
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '--no-playlist',
      '--geo-bypass',
      ...NET_ARGS,
      '-o', path.join(tempDir, `${outputName}.%(ext)s`),
      ...browserHeaders
    ];
    const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }
    args.push(url);

    execFile(ytDlpPath, args, { env }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      if (fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error('Downloaded audio file not found at ' + outputPath));
      }
    });
  });
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
    const args = [
      '--flat-playlist',
      '--dump-json',
      '--no-playlist',
      '--geo-bypass',
      ...NET_ARGS,
      ...browserHeaders
    ];
    const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }
    args.push(searchTarget);

    execFile(ytDlpPath, args, { maxBuffer: 15 * 1024 * 1024, env }, (err, stdout, stderr) => {
      if (err && !stdout) {
        return reject(new Error(stderr || err.message));
      }

      const results = [];
      const lines = stdout.trim().split('\n');
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
