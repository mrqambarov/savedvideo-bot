const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
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
 * Extracts audio from a video file and encodes it as high-quality MP3
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to output MP3
 */
function extractAudio(inputPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.mp3`);
  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-q:a', '4', // 4 is standard high quality (~160kbps), much faster to encode than 0
    outputPath
  ];
  return runFFmpeg(args).then(() => outputPath);
}

/**
 * Crops a video to a 1:1 aspect ratio and optionally masks it to a circle
 * @param {string} inputPath 
 * @param {string} outputName 
 * @param {'circular' | 'square'} style 
 * @returns {Promise<string>} Path to output video
 */
function convertToRoundVideo(inputPath, outputName, style = 'circular') {
  const outputPath = path.join(tempDir, `${outputName}.mp4`);
  let filter = '';

  if (style === 'circular') {
    // 1:1 crop + circular mask blended onto black background using yuv420p format conversion
    filter = "crop=w='min(iw,ih)':h='min(iw,ih)',format=yuva420p,geq=lum='p(X,Y)':a='st(1,pow(min(W/2,H/2),2))+st(3,pow(X-(W/2),2)+pow(Y-(H/2),2));if(lte(ld(3),ld(1)),255,0)',format=yuv420p";
  } else {
    // Simple square 1:1 crop (ideal for Telegram sendVideoNote API)
    filter = "crop=w='min(iw,ih)':h='min(iw,ih)'";
  }

  const args = [
    '-y',
    '-threads', '0',
    '-i', inputPath,
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'superfast', // speed up encoding massively
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    outputPath
  ];
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
 * Slices a 4-second audio snippet and converts it to raw 16-bit PCM mono 44.1kHz for Shazam API
 * @param {string} inputPath 
 * @param {string} outputName 
 * @returns {Promise<string>} Path to raw PCM file
 */
function generateRawPcmForShazam(inputPath, outputName) {
  const outputPath = path.join(tempDir, `${outputName}.raw`);
  const args = [
    '-y',
    '-ss', '3', // Start at 3 seconds to avoid intro silence or talking
    '-t', '5',  // Slices 5 seconds (under 500KB limit for 44.1kHz mono s16le)
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
      // Fallback to starting from the absolute beginning if the file is shorter than 3 seconds
      const fallbackArgs = [
        '-y',
        '-ss', '0',
        '-t', '5',
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

module.exports = {
  extractAudio,
  convertToRoundVideo,
  applyAudioEffect,
  generateRawPcmForShazam,
  ffmpegPath,
  ffprobePath
};
