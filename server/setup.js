const fs = require('fs');
const path = require('path');
const https = require('https');

const binDir = path.join(__dirname, 'bin');
const isWindows = process.platform === 'win32';
const ytDlpName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(binDir, ytDlpName);

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

async function ensureBinaries() {
  try {
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    if (!fs.existsSync(ytDlpPath)) {
      console.log(`Downloading ${ytDlpName} (this may take a few seconds)...`);
      const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpName}`;
      await downloadFile(url, ytDlpPath);
      if (!isWindows) {
        fs.chmodSync(ytDlpPath, 0o755);
      }
      console.log(`${ytDlpName} downloaded successfully to:`, ytDlpPath);
    } else {
      console.log(`${ytDlpName} already exists.`);
      if (!isWindows) {
        try {
          fs.chmodSync(ytDlpPath, 0o755);
        } catch (e) {}
      }
    }

    // Copy ffmpeg and ffprobe from npm packages to bin/ for auto-discovery if system FFmpeg is missing
    let hasSystemFFmpeg = false;
    try {
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      hasSystemFFmpeg = true;
      console.log('System FFmpeg detected. Skipping copy.');
    } catch (e) {}

    if (!hasSystemFFmpeg) {
      console.log('Locating and copying FFmpeg/FFprobe binaries...');
      try {
        const ffmpegSource = require('@ffmpeg-installer/ffmpeg').path;
        const ffprobeSource = require('@ffprobe-installer/ffprobe').path;

        const ffmpegDestName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
        const ffprobeDestName = isWindows ? 'ffprobe.exe' : 'ffprobe';

        const ffmpegDestPath = path.join(binDir, ffmpegDestName);
        const ffprobeDestPath = path.join(binDir, ffprobeDestName);

        if (!fs.existsSync(ffmpegDestPath)) {
          fs.copyFileSync(ffmpegSource, ffmpegDestPath);
          if (!isWindows) {
            fs.chmodSync(ffmpegDestPath, 0o755);
          }
          console.log(`FFmpeg copied successfully to ${ffmpegDestName}`);
        }

        if (!fs.existsSync(ffprobeDestPath)) {
          fs.copyFileSync(ffprobeSource, ffprobeDestPath);
          if (!isWindows) {
            fs.chmodSync(ffprobeDestPath, 0o755);
          }
          console.log(`FFprobe copied successfully to ${ffprobeDestName}`);
        }
      } catch (copyErr) {
        console.warn('Could not copy FFmpeg/FFprobe binaries from node_modules:', copyErr.message);
      }
    }
  } catch (err) {
    console.error('Setup error:', err.message);
    throw err;
  }
}

async function main() {
  try {
    await ensureBinaries();
  } catch (err) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ytDlpPath, ensureBinaries };
