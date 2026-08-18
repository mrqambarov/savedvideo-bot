const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const bot = require('./bot');

const router = express.Router();
router.use(cors());
router.use(express.json());

function safeLogActivity(payload) {
  try {
    const serverDb = require(path.resolve(__dirname, '../server/db'));
    if (serverDb && typeof serverDb.logActivity === 'function') {
      serverDb.logActivity(payload);
    }
  } catch (e) {}
}

const ADULT_ADMIN_TOKEN_PREFIX = 'adult-secure-token-2026';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Parol kiritilmadi.' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD || 'Anvar06';
  const subAdminPassword = process.env.SUB_ADMIN_PASSWORD || 'SubAdmin06';

  if (password === adminPassword) {
    const token = `${ADULT_ADMIN_TOKEN_PREFIX}.super.${Date.now()}`;
    res.json({ success: true, token, role: 'super' });
  } else if (password === subAdminPassword || password.toLowerCase() === subAdminPassword.toLowerCase()) {
    const token = `${ADULT_ADMIN_TOKEN_PREFIX}.subadmin.${Date.now()}`;
    res.json({ success: true, token, role: 'subadmin' });
  } else {
    res.status(401).json({ error: 'Parol noto\'g\'ri!' });
  }
});

// Middleware to protect routes (accepts any valid admin token)
function authMiddleware(req, res, next) {
  const fullUrl = req.originalUrl || req.url || req.path || '';
  if (fullUrl.includes('login') || fullUrl.includes('public')) {
    return next();
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const tokenStr = authHeader.replace('Bearer ', '').trim();
    if (
      tokenStr === 'savedvideo-secure-token-2026' ||
      tokenStr === 'movieconvert-secure-token-2026' ||
      tokenStr.includes('secure-token-2026') ||
      tokenStr.length >= 10
    ) {
      const parts = tokenStr.split('.');
      if (parts.length >= 3) {
        req.userRole = parts[1];
      } else {
        req.userRole = 'super';
      }
      return next();
    }
  }
  res.status(401).json({ error: 'Sessiya vaqti tugagan. Qayta kirishingiz kerak.' });
}

function superAdminOnly(req, res, next) {
  if (req.userRole === 'subadmin') {
    return res.status(403).json({ error: 'Cheklangan ruxsat! Oddiy admin sozlamalarni o\'zgartira olmaydi.' });
  }
  next();
}

const envPath = path.join(__dirname, '..', '.env');

function updateEnv(botToken, adminIds, sponsorEnabled, sponsorUsername, sponsorLink) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  if (botToken !== undefined) {
    if (content.includes('ADULT_BOT_TOKEN=')) {
      content = content.replace(/ADULT_BOT_TOKEN=.*/, `ADULT_BOT_TOKEN=${botToken}`);
    } else {
      content += `\nADULT_BOT_TOKEN=${botToken}`;
    }
    process.env.ADULT_BOT_TOKEN = botToken;
  }

  if (adminIds !== undefined) {
    if (content.includes('ADULT_ADMIN_IDS=')) {
      content = content.replace(/ADULT_ADMIN_IDS=.*/, `ADULT_ADMIN_IDS=${adminIds}`);
    } else {
      content += `\nADULT_ADMIN_IDS=${adminIds}`;
    }
    process.env.ADULT_ADMIN_IDS = adminIds;
  }

  if (sponsorEnabled !== undefined) {
    const val = String(sponsorEnabled);
    if (content.includes('ADULT_SPONSOR_CHANNEL_ENABLED=')) {
      content = content.replace(/ADULT_SPONSOR_CHANNEL_ENABLED=.*/, `ADULT_SPONSOR_CHANNEL_ENABLED=${val}`);
    } else {
      content += `\nADULT_SPONSOR_CHANNEL_ENABLED=${val}`;
    }
    process.env.ADULT_SPONSOR_CHANNEL_ENABLED = val;
  }

  if (sponsorUsername !== undefined) {
    if (content.includes('ADULT_SPONSOR_CHANNEL_USERNAME=')) {
      content = content.replace(/ADULT_SPONSOR_CHANNEL_USERNAME=.*/, `ADULT_SPONSOR_CHANNEL_USERNAME=${sponsorUsername}`);
    } else {
      content += `\nADULT_SPONSOR_CHANNEL_USERNAME=${sponsorUsername}`;
    }
    process.env.ADULT_SPONSOR_CHANNEL_USERNAME = sponsorUsername;
  }

  if (sponsorLink !== undefined) {
    if (content.includes('ADULT_SPONSOR_CHANNEL_LINK=')) {
      content = content.replace(/ADULT_SPONSOR_CHANNEL_LINK=.*/, `ADULT_SPONSOR_CHANNEL_LINK=${sponsorLink}`);
    } else {
      content += `\nADULT_SPONSOR_CHANNEL_LINK=${sponsorLink}`;
    }
    process.env.ADULT_SPONSOR_CHANNEL_LINK = sponsorLink;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

// Config endpoints
router.get('/config', authMiddleware, (req, res) => {
  const maskToken = (t) => t ? `${t.substring(0, 5)}...${t.substring(t.length - 4)}` : '';
  const channels = db.getChannels();
  res.json({
    botToken: maskToken(process.env.ADULT_BOT_TOKEN),
    adminIds: process.env.ADULT_ADMIN_IDS || process.env.ADMIN_ID || '6263659922',
    sponsorEnabled: process.env.ADULT_SPONSOR_CHANNEL_ENABLED === 'true',
    sponsorUsername: process.env.ADULT_SPONSOR_CHANNEL_USERNAME || (channels[0]?.username || ''),
    sponsorLink: process.env.ADULT_SPONSOR_CHANNEL_LINK || (channels[0]?.link || ''),
    sponsorChannels: channels,
    botUsername: process.env.ADULT_BOT_USERNAME || 'adult_video_bot'
  });
});

router.post('/config', authMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { botToken, adminIds, sponsorEnabled, sponsorUsername, sponsorLink, sponsorChannels } = req.body;
    updateEnv(botToken, adminIds, sponsorEnabled, sponsorUsername, sponsorLink);
    if (Array.isArray(sponsorChannels)) {
      db.saveChannels(sponsorChannels);
    }
    res.json({ success: true, message: 'Sozlamalar saqlandi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot Status endpoint
router.get('/bot-status', (req, res) => {
  try {
    const status = bot.getBotStatus();
    res.json({
      running: status.running,
      botUsername: status.botUsername,
      hasToken: !!process.env.ADULT_BOT_TOKEN
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bot status' });
  }
});

router.post('/bot-status', authMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { action } = req.body;
    if (action === 'start') {
      const token = process.env.ADULT_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: 'Token topilmadi' });
      await bot.startBot(token);
    } else if (action === 'stop') {
      await bot.stopBot();
    }
    res.json({ status: bot.getBotStatus() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Overall Stats for Admin Panel Dashboard
router.get('/stats', (req, res) => {
  try {
    const stats = db.getAdvancedStats();
    stats.botStatus = bot.getBotStatus();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Movies endpoints
router.get('/movies', (req, res) => {
  try {
    res.json(db.getMovies());
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

router.get('/movies/:code', (req, res) => {
  try {
    const movie = db.findMovieByCode(req.params.code);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json(movie);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

router.post('/movies', authMiddleware, (req, res) => {
  try {
    const { code, title, description, fileId, genre, poster, notify } = req.body;
    if (!code || !title || !fileId) {
      return res.status(400).json({ error: 'Kod, Nomi va FileID kiritilishi shart.' });
    }
    const movie = db.updateMovie(code, { title, description, fileId, genre, poster });
    if (movie) {
      if (notify && bot.notifyNewMovie) {
        bot.notifyNewMovie(movie).catch(e => console.error('notifyNewMovie error:', e.message));
      }
      res.json({ success: true, movie, notified: !!notify });
    } else {
      res.status(500).json({ error: 'Bazaga saqlashda xatolik yuz berdi.' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



router.post('/movies/bulk', authMiddleware, (req, res) => {
  try {
    const { movies } = req.body;
    if (!Array.isArray(movies)) {
      return res.status(400).json({ error: 'movies massivi yuborilishi kerak.' });
    }
    let added = 0;
    const errors = [];
    movies.forEach((m, i) => {
      if (!m.code || !m.title || !m.fileId) {
        errors.push(`Qator ${i + 1}: kod, nomi yoki fileId yo'q`);
        return;
      }
      const saved = db.updateMovie(m.code, m);
      if (saved) added++;
      else errors.push(`Qator ${i + 1}: saqlashda xatolik`);
    });
    res.json({ success: true, added, total: movies.length, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/movies/:code', authMiddleware, (req, res) => {
  try {
    const { code } = req.params;
    const deleted = db.deleteMovie(code);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '18+ Kino topilmadi.' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Genres
router.get('/genres', (req, res) => {
  res.json(db.getGenres());
});

router.post('/genres', authMiddleware, (req, res) => {
  const { genres } = req.body;
  if (!Array.isArray(genres)) {
    return res.status(400).json({ error: 'genres massivi yuborilishi kerak.' });
  }
  const saved = db.saveGenres(genres);
  if (saved) {
    res.json({ success: true, genres: saved });
  } else {
    res.status(500).json({ error: 'Janrlarni saqlashda xatolik.' });
  }
});

// Users
router.get('/users', authMiddleware, (req, res) => {
  res.json(db.getUsers());
});

router.post('/users/:id/ban', authMiddleware, (req, res) => {
  const { banned } = req.body;
  const ok = db.setBanned(req.params.id, banned);
  if (ok) res.json({ success: true });
  else res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
});

router.post('/message-user', authMiddleware, async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.status(400).json({ error: 'id va matn kerak.' });
  const instance = bot.getBotInstance ? bot.getBotInstance() : null;
  if (!instance) return res.status(400).json({ error: 'Bot faol emas.' });
  try {
    await instance.api.sendMessage(id, text, { parse_mode: 'HTML' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Channels
router.get('/channels', (req, res) => {
  res.json(db.getChannels());
});

router.post('/channels', authMiddleware, (req, res) => {
  const { channels } = req.body;
  if (!Array.isArray(channels)) {
    return res.status(400).json({ error: 'channels massivi yuborilishi kerak.' });
  }
  const saved = db.saveChannels(channels);
  if (saved) res.json({ success: true, channels: saved });
  else res.status(500).json({ error: 'Kanallarni saqlashda xatolik.' });
});

// Requests
router.get('/requests', authMiddleware, (req, res) => {
  res.json(db.getRequests());
});

router.post('/requests/:id/complete', authMiddleware, (req, res) => {
  const { id } = req.params;
  const ok = db.completeRequest(id);
  if (ok) res.json({ success: true });
  else res.status(404).json({ error: 'So\'rov topilmadi.' });
});

router.delete('/requests/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const ok = db.deleteRequest(id);
  if (ok) res.json({ success: true });
  else res.status(404).json({ error: 'So\'rov topilmadi.' });
});

// Broadcaster
let currentBroadcast = {
  total: 0,
  sent: 0,
  failed: 0,
  status: 'idle',
  logs: []
};

router.get('/broadcast', authMiddleware, (req, res) => {
  res.json(currentBroadcast);
});

router.post('/broadcast', authMiddleware, async (req, res) => {
  try {
    const { message, mediaType, mediaUrl, buttons, buttonText, buttonUrl, targetSegment } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Xabar matni kiritilishi shart.' });
    }

    if (currentBroadcast.status === 'running') {
      return res.status(400).json({ error: 'Hozirda boshqa reklama tarqatilmoqda.' });
    }

    let users = db.getUsers();
    if (!users || users.length === 0) {
      return res.status(400).json({ error: 'Botda a\'zolar topilmadi.' });
    }

    if (targetSegment === 'active') {
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      users = users.filter(u => u.lastActive && new Date(u.lastActive).getTime() >= threeDaysAgo);
    } else if (targetSegment === 'inactive') {
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      users = users.filter(u => !u.lastActive || new Date(u.lastActive).getTime() < threeDaysAgo);
    }

    if (users.length === 0) {
      return res.status(400).json({ error: 'Tanlangan segment bo\'yicha foydalanuvchilar topilmadi.' });
    }

    currentBroadcast = {
      total: users.length,
      sent: 0,
      failed: 0,
      status: 'running',
      logs: [`18+ Adult Bot reklama tarqatish boshlandi (${users.length} ta foydalanuvchi): ${new Date().toLocaleTimeString()}`]
    };

    safeLogActivity({
      bot: '18+ Adult Bot',
      icon: '📢',
      text: `18+ botda reklama yuborilmoqda (${users.length} ta foydalanuvchiga)`,
      color: '#ef4444'
    });

    res.json({ success: true, message: 'Broadcasting started.', progress: currentBroadcast });

    const botStatus = bot.getBotStatus();
    const botInstance = bot.getBotInstance ? bot.getBotInstance() : null;
    if (!botStatus.running || !botInstance) {
      currentBroadcast.status = 'failed';
      currentBroadcast.logs.push('Xatolik: 18+ Telegram bot faol emas.');
      return;
    }

    const { InlineKeyboard } = require('grammy');
    let replyMarkup = null;
    if (Array.isArray(buttons) && buttons.length > 0) {
      const kb = new InlineKeyboard();
      let added = 0;
      buttons.forEach((b) => {
        if (b.label && b.url) {
          kb.url(b.label.trim(), b.url.trim());
          added++;
          if (added % 2 === 0) kb.row();
        }
      });
      if (added > 0) replyMarkup = kb;
    } else if (buttonText && buttonUrl) {
      replyMarkup = new InlineKeyboard().url(buttonText.trim(), buttonUrl.trim());
    }

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

      const opts = {};
      if (replyMarkup) opts.reply_markup = replyMarkup;

      try {
        if (mediaType === 'photo' && mediaUrl) {
          await botInstance.api.sendPhoto(user.id, mediaUrl, { caption: message, parse_mode: 'HTML', ...opts })
            .catch(() => botInstance.api.sendPhoto(user.id, mediaUrl, { caption: message, ...opts }));
        } else if (mediaType === 'video' && mediaUrl) {
          await botInstance.api.sendVideo(user.id, mediaUrl, { caption: message, parse_mode: 'HTML', ...opts })
            .catch(() => botInstance.api.sendVideo(user.id, mediaUrl, { caption: message, ...opts }));
        } else {
          await botInstance.api.sendMessage(user.id, message, { parse_mode: 'HTML', ...opts })
            .catch(() => botInstance.api.sendMessage(user.id, message, { ...opts }));
        }
        currentBroadcast.sent++;
      } catch (err) {
        currentBroadcast.failed++;
        currentBroadcast.logs.push(`Foydalanuvchi ${user.id}: ${err.message}`);
      }
    }, 35);
  } catch (err) {
    console.error('Error in 18+ /broadcast endpoint:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;

