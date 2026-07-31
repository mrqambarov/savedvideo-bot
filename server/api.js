const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const downloader = require('./downloader');
const processor = require('./processor');
const bot = require('./bot');
const axios = require('axios');
const { execFile } = require('child_process');
const { InlineKeyboard } = require('grammy');
const db = require('./db');
const sponsorManager = require('./sponsorManager');

const tempUploads = path.join(downloader.tempDir, 'uploads');
if (!fs.existsSync(tempUploads)) {
  fs.mkdirSync(tempUploads, { recursive: true });
}

// Config Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploads);
  },
  filename: (req, file, cb) => {
    const fileId = Math.random().toString(36).substring(2, 8);
    cb(null, `${fileId}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for web uploads
});

const envPath = path.join(__dirname, '..', '.env');

// Auth Token and Route
const ADMIN_TOKEN = 'vibeconvert-secure-token-2026';

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Parol kiritilmadi.' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD || 'Anvar06';
  if (password === adminPassword) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const sessionId = db.addSession(ip, userAgent, ADMIN_TOKEN);
    res.json({ success: true, token: ADMIN_TOKEN, sessionId });
  } else {
    res.status(401).json({ error: 'Parol noto\'g\'ri!' });
  }
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader === `Bearer ${ADMIN_TOKEN}`) {
    return next();
  }
  res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan!' });
}

router.use(authMiddleware);

/**
 * Utility to write variables back to .env
 */
function updateEnv(botToken, shazamKey, sponsorEnabled, sponsorUsername, sponsorLink, adminIds) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  if (botToken !== undefined) {
    if (content.includes('TELEGRAM_BOT_TOKEN=')) {
      content = content.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${botToken}`);
    } else {
      content += `\nTELEGRAM_BOT_TOKEN=${botToken}`;
    }
    process.env.TELEGRAM_BOT_TOKEN = botToken;
  }

  if (adminIds !== undefined) {
    if (content.includes('ADMIN_IDS=')) {
      content = content.replace(/ADMIN_IDS=.*/, `ADMIN_IDS=${adminIds}`);
    } else {
      content += `\nADMIN_IDS=${adminIds}`;
    }
    process.env.ADMIN_IDS = adminIds;
  }

  if (shazamKey !== undefined) {
    if (content.includes('SHAZAM_RAPIDAPI_KEY=')) {
      content = content.replace(/SHAZAM_RAPIDAPI_KEY=.*/, `SHAZAM_RAPIDAPI_KEY=${shazamKey}`);
    } else {
      content += `\nSHAZAM_RAPIDAPI_KEY=${shazamKey}`;
    }
    process.env.SHAZAM_RAPIDAPI_KEY = shazamKey;
  }

  if (sponsorEnabled !== undefined) {
    const val = String(sponsorEnabled);
    if (content.includes('SPONSOR_CHANNEL_ENABLED=')) {
      content = content.replace(/SPONSOR_CHANNEL_ENABLED=.*/, `SPONSOR_CHANNEL_ENABLED=${val}`);
    } else {
      content += `\nSPONSOR_CHANNEL_ENABLED=${val}`;
    }
    process.env.SPONSOR_CHANNEL_ENABLED = val;
  }

  if (sponsorUsername !== undefined) {
    if (content.includes('SPONSOR_CHANNEL_USERNAME=')) {
      content = content.replace(/SPONSOR_CHANNEL_USERNAME=.*/, `SPONSOR_CHANNEL_USERNAME=${sponsorUsername}`);
    } else {
      content += `\nSPONSOR_CHANNEL_USERNAME=${sponsorUsername}`;
    }
    process.env.SPONSOR_CHANNEL_USERNAME = sponsorUsername;
  }

  if (sponsorLink !== undefined) {
    if (content.includes('SPONSOR_CHANNEL_LINK=')) {
      content = content.replace(/SPONSOR_CHANNEL_LINK=.*/, `SPONSOR_CHANNEL_LINK=${sponsorLink}`);
    } else {
      content += `\nSPONSOR_CHANNEL_LINK=${sponsorLink}`;
    }
    process.env.SPONSOR_CHANNEL_LINK = sponsorLink;
  }

  if (customCaption !== undefined) {
    if (content.includes('CUSTOM_CAPTION=')) {
      content = content.replace(/CUSTOM_CAPTION=.*/, `CUSTOM_CAPTION=${customCaption}`);
    } else {
      content += `\nCUSTOM_CAPTION=${customCaption}`;
    }
    process.env.CUSTOM_CAPTION = customCaption;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

/**
 * Local file metadata extractor (ffprobe)
 */
function getFileMetadata(filePath) {
  return new Promise((resolve) => {
    execFile(processor.ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ], (err, stdout) => {
      if (err) return resolve(null);
      try {
        const data = JSON.parse(stdout);
        const tags = data.format && data.format.tags;
        if (tags && (tags.title || tags.artist)) {
          return resolve({
            title: tags.title || 'Unknown Title',
            artist: tags.artist || 'Unknown Artist',
            album: tags.album || 'Unknown Album'
          });
        }
        resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

// 1. Fetch Link Details
router.post('/info', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }
  try {
    const info = await downloader.getInfo(url);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Download from Link
router.get('/download', async (req, res) => {
  const { url, format, quality } = req.query;
  if (!url) {
    return res.status(400).send('URL query parameter is required.');
  }

  const fileId = Math.random().toString(36).substring(2, 8);
  try {
    let filePath;
    if (format === 'mp3') {
      filePath = await downloader.downloadAudio(url, `web_dl_${fileId}`);
    } else {
      filePath = await downloader.downloadVideo(url, `web_dl_${fileId}`, quality || '720');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('Downloaded file not generated.');
    }

    res.download(filePath, path.basename(filePath), (err) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.error('File cleanup error:', cleanupErr);
      }
    });
  } catch (err) {
    res.status(500).send(`Failed to process download: ${err.message}`);
  }
});

// 3. Process Upload (Circular Video, Audio Extract, Effects, Identify, Trim)
router.post('/process-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const inputPath = req.file.path;
  const action = req.body.action; // 'extract-audio', 'round-video', 'audio-effect', 'identify-music', 'trim-audio'
  const style = req.body.style || 'circular'; // for round-video
  const effect = req.body.effect; // for audio-effect
  const fileId = Math.random().toString(36).substring(2, 8);

  try {
    if (action === 'extract-audio') {
      const outputPath = await processor.extractAudio(inputPath, `web_ext_${fileId}`);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } 
    else if (action === 'trim-audio') {
      const startSec = parseInt(req.body.startSec, 10) || 0;
      const durationSec = parseInt(req.body.durationSec, 10) || 30;
      const outputPath = await processor.trimAudio(inputPath, `web_trim_${fileId}`, startSec, durationSec);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } 
    else if (action === 'round-video') {
      const outputPath = await processor.convertToRoundVideo(inputPath, `web_round_${fileId}`, style);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } 
    else if (action === 'audio-effect') {
      if (!effect) {
        throw new Error('Effect name is required.');
      }
      const outputPath = await processor.applyAudioEffect(inputPath, `web_fx_${effect}_${fileId}`, effect);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } 
    else if (action === 'identify-music') {
      // Step A: Check local ID3 metadata first
      const localMeta = await getFileMetadata(inputPath);
      if (localMeta) {
        fs.unlinkSync(inputPath);
        return res.json({ success: true, source: 'metadata', data: localMeta });
      }

      // Step B: Shazam API via RapidAPI
      const apiKey = process.env.SHAZAM_RAPIDAPI_KEY;
      if (!apiKey) {
        fs.unlinkSync(inputPath);
        return res.json({ 
          success: false, 
          error: 'Mahalliy metadata topilmadi. Shazam API kaliti sozlangan emas (RapidAPI kaliti yetishmayapti).' 
        });
      }

      const rawPcmPath = await processor.generateRawPcmForShazam(inputPath, `web_pcm_${fileId}`);
      const rawData = fs.readFileSync(rawPcmPath);
      const base64Data = rawData.toString('base64');

      try {
        const response = await axios({
          method: 'POST',
          url: 'https://shazam.p.rapidapi.com/songs/detect',
          headers: {
            'content-type': 'text/plain',
            'x-rapidapi-host': 'shazam.p.rapidapi.com',
            'x-rapidapi-key': apiKey
          },
          data: base64Data,
          timeout: 15000
        });

        fs.unlinkSync(inputPath);
        fs.unlinkSync(rawPcmPath);

        if (response.data && response.data.track) {
          res.json({
            success: true,
            source: 'shazam',
            data: {
              title: response.data.track.title,
              artist: response.data.track.subtitle,
              image: response.data.track.images && response.data.track.images.background,
              shareUrl: response.data.track.url
            }
          });
        } else {
          res.json({ success: false, error: 'Musiqa aniqlanmadi (Shazam natija bermadi).' });
        }
      } catch (shazamErr) {
        fs.unlinkSync(inputPath);
        if (fs.existsSync(rawPcmPath)) fs.unlinkSync(rawPcmPath);
        res.status(500).json({ success: false, error: 'Shazam API xatosi: ' + shazamErr.message });
      }
    } 
    else {
      fs.unlinkSync(inputPath);
      res.status(400).json({ error: 'Noma\'lum amal (Action).' });
    }
  } catch (err) {
    // Make sure we clean up the original upload if process fails
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (e) {}
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Telegram Bot Status
router.get('/bot-status', (req, res) => {
  res.json(bot.getBotStatus());
});

// 5. Start/Stop Bot
router.post('/bot-status', async (req, res) => {
  const { action } = req.body;
  const status = bot.getBotStatus();
  
  try {
    if (action === 'start') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return res.status(400).json({ error: 'Telegram Bot tokeni sozlangan emas.' });
      }
      await bot.startBot(token);
      res.json({ success: true, status: bot.getBotStatus() });
    } else if (action === 'stop') {
      await bot.stopBot();
      res.json({ success: true, status: bot.getBotStatus() });
    } else {
      res.status(400).json({ error: 'Noma\'lum buyruq.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Config (Masked values)
router.get('/config', (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const shazam = process.env.SHAZAM_RAPIDAPI_KEY || '';
  
  res.json({
    botToken: token ? `${token.substring(0, 6)}...${token.substring(token.length - 4)}` : '',
    adminIds: process.env.ADMIN_IDS || '',
    shazamKey: shazam ? `${shazam.substring(0, 4)}...${shazam.substring(shazam.length - 4)}` : '',
    sponsorEnabled: process.env.SPONSOR_CHANNEL_ENABLED === 'true',
    sponsorUsername: process.env.SPONSOR_CHANNEL_USERNAME || '',
    sponsorLink: process.env.SPONSOR_CHANNEL_LINK || '',
    customCaption: process.env.CUSTOM_CAPTION || ''
  });
});

// 7. Update Config
router.post('/config', async (req, res) => {
  const { botToken, shazamKey, sponsorEnabled, sponsorUsername, sponsorLink, adminIds, customCaption } = req.body;
  try {
    const isBotActive = bot.getBotStatus().running;
    
    // Stop bot first if token is changing and bot is running
    if (isBotActive && botToken !== undefined) {
      await bot.stopBot();
    }

    updateEnv(botToken, shazamKey, sponsorEnabled, sponsorUsername, sponsorLink, adminIds, customCaption);

    // Restart bot if it was active
    if (isBotActive && process.env.TELEGRAM_BOT_TOKEN) {
      await bot.startBot(process.env.TELEGRAM_BOT_TOKEN);
    }

    res.json({ success: true, status: bot.getBotStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7b. Upload cookies.txt
router.post('/upload-cookies', upload.single('cookies'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fayl tanlanmagan.' });
  }

  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, '..', 'cookies.txt');

  try {
    fs.copyFileSync(tempPath, targetPath);
    fs.unlinkSync(tempPath);
    res.json({ success: true, message: 'cookies.txt muvaffaqiyatli saqlandi!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Get Users and usage stats (Advanced Analytics)
router.get('/stats', (req, res) => {
  try {
    res.json(db.getAdvancedStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8a. Referral leaderboard (contest)
router.get('/referrals', (req, res) => {
  try {
    res.json(db.getReferralLeaderboard(200));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8b. User management
router.get('/users', (req, res) => {
  res.json(db.getUsers());
});

router.post('/users/:id/ban', (req, res) => {
  const { banned } = req.body;
  const ok = db.setBanned(req.params.id, banned);
  if (ok) res.json({ success: true });
  else res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
});

router.post('/message-user', async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.status(400).json({ error: 'id va matn kerak.' });
  const instance = bot.getBotInstance();
  if (!instance) return res.status(400).json({ error: 'Bot faol emas.' });
  try {
    await instance.api.sendMessage(id, text, { parse_mode: 'HTML' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8b. Channels Management (Smart Sponsor System)
router.get('/channels', (req, res) => {
  try {
    const channels = sponsorManager.getChannels();
    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/channels', (req, res) => {
  try {
    const { channels } = req.body;
    if (!Array.isArray(channels)) {
      return res.status(400).json({ error: 'channels massivi yuborilishi kerak.' });
    }

    const updated = channels.map((c, idx) => ({
      id: c.id || `ch_${Date.now()}_${idx}`,
      username: String(c.username || '').trim(),
      link: String(c.link || '').trim(),
      targetCount: Number(c.targetCount) || 0,
      joinedCount: Number(c.joinedCount) || 0,
      joinedUsers: Array.isArray(c.joinedUsers) ? c.joinedUsers : [],
      dailyStats: c.dailyStats || {},
      monthlyStats: c.monthlyStats || {},
      active: c.active !== undefined ? Boolean(c.active) : true
    })).filter(c => c.username && c.link);

    sponsorManager.saveChannels(updated);
    res.json({ success: true, channels: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Process Upload (Circular Video, Audio Extract, Effects, Identify, Trim, Speed, Audio-to-Round)
router.post('/process-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const inputPath = req.file.path;
  const action = req.body.action; // 'extract-audio', 'round-video', 'audio-effect', 'identify-music', 'trim-audio', 'speed-audio', 'audio-to-round-video'
  const style = req.body.style || 'circular'; // for round-video
  const effect = req.body.effect; // for audio-effect
  const fileId = Math.random().toString(36).substring(2, 8);

  try {
    if (action === 'extract-audio') {
      const outputPath = await processor.extractAudio(inputPath, `web_ext_${fileId}`);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } 
    else if (action === 'trim-audio') {
      const startSec = parseInt(req.body.startSec, 10) || 0;
      const durationSec = parseInt(req.body.durationSec, 10) || 30;
      const outputPath = await processor.trimAudio(inputPath, `web_trim_${fileId}`, startSec, durationSec);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    }
    else if (action === 'speed-audio') {
      const speedFactor = parseFloat(req.body.speedFactor) || 1.25;
      const outputPath = await processor.changeAudioSpeed(inputPath, `web_speed_${fileId}`, speedFactor);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    }
    else if (action === 'audio-to-round-video') {
      const outputPath = await processor.convertAudioToRoundVideo(inputPath, `web_round_audio_${fileId}`);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    }
    else if (action === 'round-video') {
      const outputPath = await processor.convertToRoundVideo(inputPath, `web_round_${fileId}`, style);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } else if (action === 'audio-effect') {
      const outputPath = await processor.applyAudioEffect(inputPath, `web_fx_${fileId}`, effect);
      res.download(outputPath, path.basename(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    } else if (action === 'identify-music') {
      const rawPath = await processor.generateRawPcmForShazam(inputPath, `web_shazam_${fileId}`);
      try {
        const result = await shazam.identifySong(rawPath);
        res.json({ success: true, result });
      } catch (shazamErr) {
        res.status(404).json({ error: shazamErr.message });
      } finally {
        fs.unlinkSync(inputPath);
        if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      }
    } else {
      fs.unlinkSync(inputPath);
      res.status(400).json({ error: 'Noma\'lum amalgam.' });
    }
  } catch (err) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).json({ error: err.message });
  }
});

let currentBroadcast = {
  total: 0,
  sent: 0,
  failed: 0,
  status: 'idle',
  logs: []
};

// Get broadcast progress
router.get('/broadcast', (req, res) => {
  res.json(currentBroadcast);
});

// Start broadcast
router.post('/broadcast', async (req, res) => {
  const { message, buttonText, buttonUrl, mediaType, mediaUrl, buttons } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Xabar matni kiritilishi shart.' });
  }

  if (currentBroadcast.status === 'running') {
    return res.status(400).json({ error: 'Hozirda boshqa reklama tarqatilmoqda.' });
  }

  const users = db.getUsers();
  if (users.length === 0) {
    return res.status(400).json({ error: 'Botda ro\'yxatdan o\'tgan foydalanuvchilar topilmadi.' });
  }

  currentBroadcast = {
    total: users.length,
    sent: 0,
    failed: 0,
    status: 'running',
    logs: [`Reklama tarqatish boshlandi: ${new Date().toLocaleTimeString()}`]
  };

  res.json({ success: true, message: 'Broadcasting started.', progress: currentBroadcast });

  // Background broadcast loop
  const botStatus = bot.getBotStatus();
  if (!botStatus.running || !bot.getBotInstance()) {
    currentBroadcast.status = 'failed';
    currentBroadcast.logs.push('Xatolik: Telegram Bot o\'chiq holatda.');
    return;
  }

  const telegramBot = bot.getBotInstance();

  let index = 0;
  const interval = setInterval(async () => {
    if (index >= users.length) {
      clearInterval(interval);
      currentBroadcast.status = 'completed';
      currentBroadcast.logs.push(`Reklama tugatildi: ${new Date().toLocaleTimeString()}. Muvaffaqiyatli: ${currentBroadcast.sent}, Xato: ${currentBroadcast.failed}`);
      return;
    }

    const user = users[index];
    index++;

    try {
      const keyboard = new InlineKeyboard();
      const btnList = Array.isArray(buttons) && buttons.length > 0
        ? buttons
        : (buttonText && buttonUrl ? [{ label: buttonText, url: buttonUrl }] : []);

      btnList.forEach((btn, idx) => {
        const label = btn.label || btn.text || 'Tugma';
        const url = btn.url;
        if (url) {
          keyboard.url(label, url);
          if ((idx + 1) % 2 === 0) keyboard.row();
        }
      });

      const options = { parse_mode: 'HTML' };
      if (btnList.length > 0) {
        options.reply_markup = keyboard;
      }

      if (mediaType === 'photo' && mediaUrl) {
        await telegramBot.api.sendPhoto(user.id, mediaUrl, { caption: message, ...options });
      } else if (mediaType === 'video' && mediaUrl) {
        await telegramBot.api.sendVideo(user.id, mediaUrl, { caption: message, ...options });
      } else {
        await telegramBot.api.sendMessage(user.id, message, options);
      }
      currentBroadcast.sent++;
    } catch (err) {
      currentBroadcast.failed++;
      currentBroadcast.logs.push(`Foydalanuvchi ${user.id} (${user.username || 'noma\'lum'}): ${err.message}`);
    }
  }, 40); // 40ms interval (~25 requests/sec, safe rate-limiting)
});

// Admin Password Change Endpoint
router.post('/change-password', authMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'Yangi parol kamida 4 ta belgidan iborat bo\'lishi kerak.' });
  }
  const cleanPass = newPassword.trim();
  process.env.ADMIN_PASSWORD = cleanPass;

  if (fs.existsSync(envPath)) {
    try {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('ADMIN_PASSWORD=')) {
        content = content.replace(/ADMIN_PASSWORD=.*/g, `ADMIN_PASSWORD=${cleanPass}`);
      } else {
        content += `\nADMIN_PASSWORD=${cleanPass}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    } catch (e) {
      console.error('Error updating .env:', e.message);
    }
  }
  res.json({ success: true, message: 'Parol muvaffaqiyatli yangilandi!' });
});

// Admin Restart Bot Endpoint
router.post('/restart-bot', authMiddleware, (req, res) => {
  const { target } = req.body; // 'downloader' or 'movie'
  const targetApp = target === 'movie' ? 'movie-bot' : 'vibeconvert-bot';
  const { exec } = require('child_process');
  exec(`pm2 restart ${targetApp}`, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: 'Qayta ishga tushirishda xatolik: ' + err.message });
    }
    res.json({ success: true, message: `${targetApp} muvaffaqiyatli qayta ishga tushirildi!` });
  });
});

// Admin Clean Temp Directory Endpoint
router.post('/clean-temp', authMiddleware, (req, res) => {
  try {
    processor.cleanTempDirectory(0);
    res.json({ success: true, message: 'Vaqtinchalik fayllar va kesh xotira tozalandi!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin Download DB Backup Endpoint
router.get('/backup-data', authMiddleware, (req, res) => {
  try {
    const users = db.getUsers();
    const stats = db.getStats();
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup_savedvideo_${dateStr}.json`);
    res.send(JSON.stringify({ users, stats, date: dateStr }, null, 2));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin Active Sessions Endpoints
router.get('/sessions', authMiddleware, (req, res) => {
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const ip = String(rawIp).split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';
  const sessions = db.getSessions();
  const currentDev = sessions.find(s => s.ip === ip || s.userAgent === userAgent);

  const formatted = sessions.map(s => ({
    ...s,
    current: currentDev ? s.id === currentDev.id : (s.ip === ip)
  }));
  res.json(formatted);
});

router.post('/revoke-session', authMiddleware, (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) db.revokeSession(sessionId);
  res.json({ success: true, message: 'Seans yakunlandi!' });
});

router.post('/revoke-other-sessions', authMiddleware, (req, res) => {
  const { currentId } = req.body;
  db.revokeOtherSessions(currentId);
  res.json({ success: true, message: 'Barcha boshqa seanslar yakunlandi!' });
});

// Get Bot Info for Token Switcher
router.get('/bot-info', authMiddleware, async (req, res) => {
  try {
    const downloaderToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const movieToken = process.env.MOVIE_BOT_TOKEN || downloaderToken;
    const downloaderUser = process.env.DOWNLOADER_BOT_USERNAME || 'savemedia_music_bot';
    const movieUser = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';

    const maskToken = (t) => t ? `${t.substring(0, 7)}...${t.slice(-5)}` : 'O\'rnatilmagan';

    res.json({
      downloader: {
        username: downloaderUser,
        tokenMasked: maskToken(downloaderToken),
        status: downloaderToken ? 'online' : 'offline'
      },
      movie: {
        username: movieUser,
        tokenMasked: maskToken(movieToken),
        status: movieToken ? 'online' : 'offline'
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Switch Bot Token & Auto Hot-Reload
router.post('/switch-bot-token', authMiddleware, async (req, res) => {
  const { target, newToken } = req.body;
  if (!newToken || newToken.trim().length < 20) {
    return res.status(400).json({ error: 'Yangi Telegram Bot Token kiritilmadi yoki yaroqsiz formatda!' });
  }

  const cleanToken = newToken.trim();

  try {
    const tgRes = await axios.get(`https://api.telegram.org/bot${cleanToken}/getMe`, { timeout: 8000 });
    if (!tgRes.data || !tgRes.data.ok || !tgRes.data.result) {
      return res.status(400).json({ error: 'Telegram API xatosi: Token noto\'g\'ri yoki bot topilmadi!' });
    }

    const botInfo = tgRes.data.result;
    const botUsername = botInfo.username || '';
    const botName = botInfo.first_name || '';

    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (target === 'downloader') {
        process.env.TELEGRAM_BOT_TOKEN = cleanToken;
        process.env.DOWNLOADER_BOT_USERNAME = botUsername;
        if (content.includes('TELEGRAM_BOT_TOKEN=')) {
          content = content.replace(/TELEGRAM_BOT_TOKEN=.*/g, `TELEGRAM_BOT_TOKEN=${cleanToken}`);
        } else {
          content += `\nTELEGRAM_BOT_TOKEN=${cleanToken}\n`;
        }
        if (content.includes('DOWNLOADER_BOT_USERNAME=')) {
          content = content.replace(/DOWNLOADER_BOT_USERNAME=.*/g, `DOWNLOADER_BOT_USERNAME=${botUsername}`);
        } else {
          content += `\nDOWNLOADER_BOT_USERNAME=${botUsername}\n`;
        }
      } else {
        process.env.MOVIE_BOT_TOKEN = cleanToken;
        process.env.MOVIE_BOT_USERNAME = botUsername;
        if (content.includes('MOVIE_BOT_TOKEN=')) {
          content = content.replace(/MOVIE_BOT_TOKEN=.*/g, `MOVIE_BOT_TOKEN=${cleanToken}`);
        } else {
          content += `\nMOVIE_BOT_TOKEN=${cleanToken}\n`;
        }
        if (content.includes('MOVIE_BOT_USERNAME=')) {
          content = content.replace(/MOVIE_BOT_USERNAME=.*/g, `MOVIE_BOT_USERNAME=${botUsername}`);
        } else {
          content += `\nMOVIE_BOT_USERNAME=${botUsername}\n`;
        }
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }

    const targetApp = target === 'movie' ? 'movie-bot' : 'vibeconvert-bot';
    const { exec } = require('child_process');
    exec(`pm2 restart ${targetApp}`, (err) => {
      if (err) console.error(`Error restarting ${targetApp}:`, err.message);
    });

    res.json({
      success: true,
      bot: {
        id: botInfo.id,
        name: botName,
        username: botUsername
      },
      message: `Yangi bot @${botUsername} (${botName}) muvaffaqiyatli bog'landi va 1 soniyada ishga tushirildi!`
    });
  } catch (err) {
    const errMsg = err.response?.data?.description || err.message || 'Telegram Bot API bilan bog\'lanishda xatolik!';
    res.status(400).json({ error: `Token validation xatosi: ${errMsg}` });
  }
});

module.exports = router;
