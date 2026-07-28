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
    res.json({ success: true, token: ADMIN_TOKEN });
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
function updateEnv(botToken, shazamKey, sponsorEnabled, sponsorUsername, sponsorLink) {
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
  const { url, format } = req.query;
  if (!url) {
    return res.status(400).send('URL query parameter is required.');
  }

  const fileId = Math.random().toString(36).substring(2, 8);
  try {
    let filePath;
    if (format === 'mp3') {
      filePath = await downloader.downloadAudio(url, `web_dl_${fileId}`);
    } else {
      filePath = await downloader.downloadVideo(url, `web_dl_${fileId}`);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('Downloaded file not generated.');
    }

    res.download(filePath, path.basename(filePath), (err) => {
      // Clean up after file is downloaded
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

// 3. Process Upload (Circular Video, Audio Extract, Effects, Identify)
router.post('/process-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const inputPath = req.file.path;
  const action = req.body.action; // 'extract-audio', 'round-video', 'audio-effect', 'identify-music'
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
    shazamKey: shazam ? `${shazam.substring(0, 4)}...${shazam.substring(shazam.length - 4)}` : '',
    sponsorEnabled: process.env.SPONSOR_CHANNEL_ENABLED === 'true',
    sponsorUsername: process.env.SPONSOR_CHANNEL_USERNAME || '',
    sponsorLink: process.env.SPONSOR_CHANNEL_LINK || ''
  });
});

// 7. Update Config
router.post('/config', async (req, res) => {
  const { botToken, shazamKey, sponsorEnabled, sponsorUsername, sponsorLink } = req.body;
  try {
    const isBotActive = bot.getBotStatus().running;
    
    // Stop bot first if token is changing and bot is running
    if (isBotActive && botToken !== undefined) {
      await bot.stopBot();
    }

    updateEnv(botToken, shazamKey, sponsorEnabled, sponsorUsername, sponsorLink);

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

// 8b. Channels Management (shared channels.json for sponsor rotation)
const channelsPath = path.join(__dirname, '..', 'channels.json');

router.get('/channels', (req, res) => {
  try {
    if (fs.existsSync(channelsPath)) {
      const channels = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
      res.json(channels);
    } else {
      res.json([]);
    }
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
    // Max 5 channels
    const limited = channels.slice(0, 5).map(c => ({
      username: String(c.username || '').trim(),
      link: String(c.link || '').trim()
    })).filter(c => c.username && c.link);

    fs.writeFileSync(channelsPath, JSON.stringify(limited, null, 2));
    res.json({ success: true, channels: limited });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
  const { message, buttonText, buttonUrl } = req.body;
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
      const options = {};
      if (buttonText && buttonUrl) {
        options.reply_markup = new InlineKeyboard().url(buttonText, buttonUrl);
      }

      await telegramBot.api.sendMessage(user.id, message, {
        parse_mode: 'HTML',
        ...options
      });
      currentBroadcast.sent++;
    } catch (err) {
      currentBroadcast.failed++;
      currentBroadcast.logs.push(`Foydalanuvchi ${user.id} (${user.username || 'noma\'lum'}): ${err.message}`);
    }
  }, 40); // 40ms interval (~25 requests/sec, safe rate-limiting)
});

module.exports = router;
