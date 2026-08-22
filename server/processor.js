const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolveFFmpegPath() {
  // 1. Try system ffmpeg (e.g. /usr/bin/ffmpeg)
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch (e) {}

  // 2. Try local bin folder
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const localBinPath = path.join(__dirname, 'bin', binName);
  if (fs.existsSync(localBinPath)) {
    return localBinPath;
  }

  // 3. Try npm installer package
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch (e) {
    return 'ffmpeg';
  }
}

function resolveFFprobePath() {
  // 1. Try system ffprobe (e.g. /usr/bin/ffprobe)
  try {
    execSync('ffprobe -version', { stdio: 'ignore' });
    return 'ffprobe';
  } catch (e) {}

  // 2. Try local bin folder
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'ffprobe.exe' : 'ffprobe';
  const localBinPath = path.join(__dirname, 'bin', binName);
  if (fs.existsSync(localBinPath)) {
    return localBinPath;
  }

  // 3. Try npm installer package
  try {
    return require('@ffprobe-installer/ffprobe').path;
  } catch (e) {
    return 'ffprobe';
  }
}

const ffmpegPath = resolveFFmpegPath();
const ffprobePath = resolveFFprobePath();
const tempDir = path.join(__dirname, 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Helper to execute an FFmpeg command process
 * @param {string[]} args 
 * @returns {Promise<void>}
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}. Error details: ${stderr}`));
      }
    });
  });
}

/**
 * Checks if media file contains at least one audio stream using ffprobe
 */
function hasAudioStream(filePath) {
  try {
    const out = execSync(`"${ffprobePath}" -v error -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: 'utf8' });
    return out.includes('audio');
  } catch (e) {
    return true;
  }
}

/**
 * Extracts audio from a video file and encodes it as high-quality MP3
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to output MP3
 */
async function extractAudio(inputPath, outputName) {
  if (!fs.existsSync(inputPath)) {
    throw new Error('Fayl topilmadi.');
  }

  if (!hasAudioStream(inputPath)) {
    throw new Error('Ushbu videoda ovoz / musiqa treki mavjud emas.');
  }

  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-q:a', '4',
    outputPath
  ];

  try {
    await runFFmpeg(args);
    return outputPath;
  } catch (err) {
    // Fallback attempt with generic mp3 codec
    const fallbackArgs = [
      '-y',
      '-i', inputPath,
      '-vn',
      '-c:a', 'mp3',
      outputPath
    ];
    await runFFmpeg(fallbackArgs);
    return outputPath;
  }
}

/**
 * Crops a video to a 1:1 aspect ratio and optionally masks it to a circle
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {'circular' | 'square'} style 
 * @returns {Promise<string>} Path to output video
 */
/**
 * Crops a video to a 1:1 aspect ratio suitable for Telegram Video Notes
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {'circular' | 'square'} style 
 * @returns {Promise<string>} Path to output video
 */
function convertToRoundVideo(inputPath, outputName, style = 'circular') {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  const hasAudio = hasAudioStream(inputPath);
  const filter = "crop=w='min(iw,ih)':h='min(iw,ih)',scale=480:480,format=yuv420p";

  const args = ['-y', '-threads', '0', '-i', inputPath];

  if (!hasAudio) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }

  args.push(
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    outputPath
  );

  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Applies digital audio processing filters to sound files
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {'concert' | 'bass' | 'nightcore' | 'slowed' | '8d'} effect 
 * @returns {Promise<string>} Path to processed MP3
 */
function applyAudioEffect(inputPath, outputName, effect) {
  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  let filter = '';

  switch (effect) {
    case 'concert':
      // Rich concert hall simulation (Reverb + slightly wider soundstage and volume correction)
      filter = 'freeverb=roomsize=0.8:damp=0.5:wet=0.6:dry=0.4,volume=1.1';
      break;
    case 'bass':
      // Heavy deep bass boost with gain adjustment to avoid digital clipping
      filter = 'bass=g=12:f=80,volume=1.2';
      break;
    case 'nightcore':
      // Higher tempo and pitched-up vocals
      filter = 'asetrate=48000*1.25,aresample=48000';
      break;
    case 'slowed':
      // Draped slowed speed + rich stadium reverb
      filter = 'asetrate=48000*0.85,aresample=48000,freeverb=roomsize=0.85:damp=0.5:wet=0.5:dry=0.6';
      break;
    case '8d':
      // Rotating psychoacoustic panning + reverb
      filter = 'apulsator=hz=0.125:amount=0.85,freeverb=roomsize=0.7:damp=0.5:wet=0.4:dry=0.6';
      break;
    case 'karaoke':
      // Phase-cancellation vocal removal filter
      filter = 'pan=stereo|c0=c0-c1|c1=c1-c0,volume=1.6';
      break;
    case 'autopan':
      // Pure stereo panning rotation
      filter = 'apulsator=hz=0.125:amount=0.9';
      break;
    default:
      filter = 'volume=1.0';
  }

  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-af', filter,
    '-acodec', 'libmp3lame',
    '-q:a', '4', // standard quality (~160kbps), much faster to process than 0
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Slices an audio snippet and converts it to raw 16-bit PCM mono 44.1kHz for Shazam API
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {number} startSec 
 * @param {number} durationSec 
 * @returns {Promise<string>} Path to raw PCM file
 */
function generateRawPcmForShazam(inputPath, outputName, startSec = 3, durationSec = 5) {
  const outputPath = path.join(tempDir, `${outputName}.raw`);
  const safeDuration = Math.min(Math.max(durationSec, 3), 5.5); // Ensure snippet stays <= 500KB for RapidAPI
  const args = [
    '-y',
    '-ss', String(startSec),
    '-t', String(safeDuration),
    '-i', inputPath,
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-ar', '44100',
    '-ac', '1',
    outputPath
  ];
  return runFFmpeg(args)
    .then(() => outputPath)
    .catch(() => {
      // Fallback to starting from the absolute beginning if file is shorter than startSec
      const fallbackArgs = [
        '-y',
        '-ss', '0',
        '-t', String(safeDuration),
        '-i', inputPath,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '1',
        outputPath
      ];
      return runFFmpeg(fallbackArgs).then(() => outputPath);
    });
}

/**
 * Trims an audio file starting at startSec for durationSec seconds
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {number} startSec 
 * @param {number} durationSec 
 * @returns {Promise<string>} Path to trimmed MP3 file
 */
function trimAudio(inputPath, outputName, startSec = 0, durationSec = 30) {
  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  const args = [
    '-y',
    '-ss', String(startSec),
    '-t', String(durationSec),
    '-i', inputPath,
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Changes audio playback speed
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {number} speedFactor (e.g. 0.75, 1.25, 1.5)
 * @returns {Promise<string>} Path to output MP3 file
 */
function changeAudioSpeed(inputPath, outputName, speedFactor = 1.25) {
  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  const filter = `asetrate=48000*${speedFactor},aresample=48000`;
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-af', filter,
    '-acodec', 'libmp3lame',
    '-q:a', '3',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Converts audio into a 1:1 circular Telegram Video Note (.mp4) with audio waveform animation
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to output MP4 Video Note
 */
function convertAudioToRoundVideo(inputPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-filter_complex', '[0:a]showwaves=s=600x600:mode=line:colors=0x6366f1[v]',
    '-map', '[v]',
    '-map', '0:a',
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Compresses video file to reduce MB size while preserving clean video quality
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to compressed MP4 file
 */
function compressVideo(inputPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  const hasAudio = hasAudioStream(inputPath);
  const args = ['-y', '-threads', '0', '-i', inputPath];

  if (!hasAudio) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }

  args.push(
    '-c:v', 'libx264',
    '-crf', '25',
    '-preset', 'superfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-shortest',
    outputPath
  );

  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Compresses audio file to reduced 96kbps MP3
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to compressed MP3 file
 */
function compressAudio(inputPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-acodec', 'libmp3lame',
    '-b:a', '96k',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Converts a video clip to an animated GIF/loop MP4
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to GIF MP4 file
 */
function convertToGif(inputPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-vf', 'fps=15,scale=480:-2:flags=lanczos',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-pix_fmt', 'yuv420p',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Creates a slow-motion version of a video (0.5x speed)
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {number} speedFactor
 * @returns {Promise<string>} Path to slow-mo video file
 */
function slowMotionVideo(inputPath, outputName, speedFactor = 0.5) {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  const ptsMult = (1 / speedFactor).toFixed(1);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-vf', `setpts=${ptsMult}*PTS`,
    '-af', `atempo=${speedFactor}`,
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-pix_fmt', 'yuv420p',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Scans temp directory and removes files older than maxAgeMs (default: 1 hour)
 * @param {number} maxAgeMs
 */
function cleanTempDirectory(maxAgeMs = 3600000) {
  try {
    if (!fs.existsSync(tempDir)) return;
    const now = Date.now();
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile() && (now - stats.mtimeMs) > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // Ignore single file unlink error
      }
    }
  } catch (err) {
    console.error('Error cleaning temp directory:', err.message);
  }
}

/**
 * Creates a visualizer MP4 video from an audio track with a soundwave waveform
 * @param {string} inputAudioPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to generated visualizer video
 */
function createAudioVisualizer(inputAudioPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputAudioPath,
    '-filter_complex', '[0:a]showwaves=s=1280x720:mode=line:colors=0x00f2fe[v]',
    '-map', '[v]',
    '-map', '0:a',
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

module.exports = {
  extractAudio,
  convertToRoundVideo,
  applyAudioEffect,
  generateRawPcmForShazam,
  trimAudio,
  changeAudioSpeed,
  convertAudioToRoundVideo,
  compressVideo,
  compressAudio,
  createAudioVisualizer,
  convertToGif,
  slowMotionVideo,
  cleanTempDirectory,
  ffmpegPath,
  ffprobePath
};

