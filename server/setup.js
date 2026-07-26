const fs = require('fs');
const path = require('path');
const https = require('https');

const binDir = path.join(__dirname, 'bin');
const ytDlpPath = path.join(binDir, 'yt-dlp.exe');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    if (!fs.existsSync(ytDlpPath)) {
      console.log('Downloading yt-dlp.exe (this may take a few seconds)...');
      const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
      await downloadFile(url, ytDlpPath);
      console.log('yt-dlp.exe downloaded successfully to:', ytDlpPath);
    } else {
      console.log('yt-dlp.exe already exists.');
    }

    // Copy ffmpeg and ffprobe from npm packages to bin/ for auto-discovery
    console.log('Locating and copying FFmpeg/FFprobe binaries...');
    try {
      const ffmpegSource = require('@ffmpeg-installer/ffmpeg').path;
      const ffprobeSource = require('@ffprobe-installer/ffprobe').path;

      fs.copyFileSync(ffmpegSource, path.join(binDir, 'ffmpeg.exe'));
      fs.copyFileSync(ffprobeSource, path.join(binDir, 'ffprobe.exe'));
      console.log('FFmpeg and FFprobe copied successfully to bin/!');
    } catch (copyErr) {
      console.warn('Could not copy FFmpeg/FFprobe binaries from node_modules:', copyErr.message);
    }
  } catch (err) {
    console.error('Setup error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ytDlpPath };
