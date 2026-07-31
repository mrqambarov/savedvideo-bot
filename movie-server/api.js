const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('./db');
const bot = require('./bot');
const { InlineKeyboard } = require('grammy');

const envPath = path.join(__dirname, '..', '.env');

// Auth Token and Route
const MOVIE_ADMIN_TOKEN = 'movieconvert-secure-token-2026';

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Parol kiritilmadi.' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD || 'Anvar06';
  if (password === adminPassword) {
    res.json({ success: true, token: MOVIE_ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: 'Parol noto\'g\'ri!' });
  }
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader === `Bearer ${MOVIE_ADMIN_TOKEN}`) {
    return next();
  }
  res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan!' });
}

// Public API endpoints (accessible without token by public catalog/Mini App)
router.get('/public-movies', (req, res) => {
  res.json(db.getMovies());
});

router.get('/public-genres', (req, res) => {
  res.json(db.getGenres());
});

router.get('/public-config', (req, res) => {
  res.json({
    botUsername: bot.getBotUsername() || '',
    sponsorEnabled: process.env.MOVIE_SPONSOR_CHANNEL_ENABLED === 'true',
    sponsorLink: process.env.MOVIE_SPONSOR_CHANNEL_LINK || ''
  });
});

router.get('/public-reviews/:code', (req, res) => {
  const { code } = req.params;
  res.json(db.getMovieReviews(code));
});

router.post('/public-reviews/:code', (req, res) => {
  const { code } = req.params;
  const { name, rating, comment } = req.body;
  if (!comment || comment.trim() === '') {
    return res.status(400).json({ error: 'Sharh matni kiritilishi kerak!' });
  }
  const result = db.addMovieReview(code, { name, rating, comment });
  res.json(result);
});

router.get('/public-mood-recommendations', (req, res) => {
  const { mood } = req.query;
  res.json(db.recommendMoviesByMood(mood));
});

router.use(authMiddleware);

const aiPublisher = require('./aiPublisher');

router.post('/ai-generate-movie-promo', (req, res) => {
  const { title, customCode, genre } = req.body;
  const data = aiPublisher.generateAiMovieMetadata({ title, customCode, genre });
  res.json(data);
});

router.post('/publish-social-promo', async (req, res) => {
  const { code, title, telegramPostText } = req.body;
  const botInstance = bot.getBotInstance();
  const result = await aiPublisher.publishSocialPromo({ code, title, telegramPostText, botInstance });
  res.json(result);
});

router.get('/instagram-config', (req, res) => {
  const config = db.getInstagramConfig();
  res.json({
    username: config.username || '',
    hasPassword: !!config.password,
    autoPost: !!config.autoPost,
    updatedAt: config.updatedAt || null
  });
});

router.post('/instagram-config', async (req, res) => {
  const { username, password } = req.body;
  const result = await aiPublisher.verifyAndSaveInstagramAccount({ username, password });
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/verify-instagram-account', async (req, res) => {
  const { username, password } = req.body;
  const result = await aiPublisher.verifyAndSaveInstagramAccount({ username, password });
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/publish-instagram', async (req, res) => {
  const { title, code, genre, instagramCaption } = req.body;
  const result = await aiPublisher.publishToInstagram({ title, code, genre, caption: instagramCaption });
  res.json(result);
});

/**
 * Utility to write variables back to .env
 */
function updateEnv(botToken, adminIds, sponsorEnabled, sponsorUsername, sponsorLink) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  if (botToken !== undefined) {
    if (content.includes('MOVIE_BOT_TOKEN=')) {
      content = content.replace(/MOVIE_BOT_TOKEN=.*/, `MOVIE_BOT_TOKEN=${botToken}`);
    } else {
      content += `\nMOVIE_BOT_TOKEN=${botToken}`;
    }
    process.env.MOVIE_BOT_TOKEN = botToken;
  }

  if (adminIds !== undefined) {
    if (content.includes('MOVIE_ADMIN_IDS=')) {
      content = content.replace(/MOVIE_ADMIN_IDS=.*/, `MOVIE_ADMIN_IDS=${adminIds}`);
    } else {
      content += `\nMOVIE_ADMIN_IDS=${adminIds}`;
    }
    process.env.MOVIE_ADMIN_IDS = adminIds;
  }

  if (sponsorEnabled !== undefined) {
    const val = String(sponsorEnabled);
    if (content.includes('MOVIE_SPONSOR_CHANNEL_ENABLED=')) {
      content = content.replace(/MOVIE_SPONSOR_CHANNEL_ENABLED=.*/, `MOVIE_SPONSOR_CHANNEL_ENABLED=${val}`);
    } else {
      content += `\nMOVIE_SPONSOR_CHANNEL_ENABLED=${val}`;
    }
    process.env.MOVIE_SPONSOR_CHANNEL_ENABLED = val;
  }

  if (sponsorUsername !== undefined) {
    if (content.includes('MOVIE_SPONSOR_CHANNEL_USERNAME=')) {
      content = content.replace(/MOVIE_SPONSOR_CHANNEL_USERNAME=.*/, `MOVIE_SPONSOR_CHANNEL_USERNAME=${sponsorUsername}`);
    } else {
      content += `\nMOVIE_SPONSOR_CHANNEL_USERNAME=${sponsorUsername}`;
    }
    process.env.MOVIE_SPONSOR_CHANNEL_USERNAME = sponsorUsername;
  }

  if (sponsorLink !== undefined) {
    if (content.includes('MOVIE_SPONSOR_CHANNEL_LINK=')) {
      content = content.replace(/MOVIE_SPONSOR_CHANNEL_LINK=.*/, `MOVIE_SPONSOR_CHANNEL_LINK=${sponsorLink}`);
    } else {
      content += `\nMOVIE_SPONSOR_CHANNEL_LINK=${sponsorLink}`;
    }
    process.env.MOVIE_SPONSOR_CHANNEL_LINK = sponsorLink;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

// 1. Get and Add Movies
router.get('/movies', (req, res) => {
  res.json(db.getMovies());
});

router.post('/movies', (req, res) => {
  const { code, title, description, fileId, genre, poster, notify } = req.body;
  if (!code || !title || !fileId) {
    return res.status(400).json({ error: 'Kod, Nomi va FileID kiritilishi shart.' });
  }
  const movie = db.addMovie({ code, title, description, fileId, genre, poster });
  if (movie) {
    if (notify) {
      // Fire-and-forget broadcast to all users about the new movie.
      bot.notifyNewMovie(movie).catch(e => console.error('notifyNewMovie error:', e.message));
    }
    res.json({ success: true, movie, notified: !!notify });
  } else {
    res.status(500).json({ error: 'Bazaga saqlashda xatolik yuz berdi.' });
  }
});

// Bulk import movies (array of { code, title, description, genre, fileId, poster })
router.post('/movies/bulk', (req, res) => {
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
    const saved = db.addMovie(m);
    if (saved) added++;
    else errors.push(`Qator ${i + 1}: saqlashda xatolik`);
  });
  res.json({ success: true, added, total: movies.length, errors });
});

// 1b. Genres management
router.get('/genres', (req, res) => {
  res.json(db.getGenres());
});

router.post('/genres', (req, res) => {
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

// 1c. Search analytics (top queries + zero-result queries)
router.get('/search-analytics', (req, res) => {
  res.json(db.getSearchAnalytics());
});

// 1d. Referral leaderboard (contest)
router.get('/referrals', (req, res) => {
  res.json(db.getReferralLeaderboard(200));
});

// 1d2. Referral reward tiers
router.get('/reward-tiers', (req, res) => {
  res.json(db.getRewardTiers());
});

router.post('/reward-tiers', (req, res) => {
  const { tiers } = req.body;
  if (!Array.isArray(tiers)) return res.status(400).json({ error: 'tiers massivi kerak.' });
  const saved = db.saveRewardTiers(tiers);
  if (saved) res.json({ success: true, tiers: saved });
  else res.status(500).json({ error: 'Saqlashda xatolik.' });
});

// 1e. User management
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

router.delete('/movies/:code', (req, res) => {
  const { code } = req.params;
  const deleted = db.deleteMovie(code);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Kino topilmadi.' });
  }
});

// 2. Get/Update Config
router.get('/config', (req, res) => {
  const token = process.env.MOVIE_BOT_TOKEN || '';
  const adminIds = process.env.MOVIE_ADMIN_IDS || '';
  res.json({
    botToken: token ? `${token.substring(0, 6)}...${token.substring(token.length - 4)}` : '',
    adminIds: adminIds,
    sponsorEnabled: process.env.MOVIE_SPONSOR_CHANNEL_ENABLED === 'true',
    sponsorUsername: process.env.MOVIE_SPONSOR_CHANNEL_USERNAME || '',
    sponsorLink: process.env.MOVIE_SPONSOR_CHANNEL_LINK || '',
    botUsername: bot.getBotUsername() || ''
  });
});

router.post('/config', async (req, res) => {
  const { botToken, adminIds, sponsorEnabled, sponsorUsername, sponsorLink } = req.body;
  try {
    const isBotActive = bot.getBotStatus().running;
    if (isBotActive && botToken !== undefined) {
      await bot.stopBot();
    }

    updateEnv(botToken, adminIds, sponsorEnabled, sponsorUsername, sponsorLink);

    if (isBotActive && process.env.MOVIE_BOT_TOKEN) {
      await bot.startBot(process.env.MOVIE_BOT_TOKEN);
    }
    res.json({ success: true, status: bot.getBotStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Bot Status Control
router.get('/bot-status', (req, res) => {
  res.json(bot.getBotStatus());
});

router.post('/bot-status', async (req, res) => {
  const { action } = req.body;
  try {
    if (action === 'start') {
      const token = process.env.MOVIE_BOT_TOKEN;
      if (!token) {
        return res.status(400).json({ error: 'Kino Bot tokeni sozlangan emas.' });
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

// 4. Stats (Advanced Analytics)
router.get('/stats', (req, res) => {
  try {
    res.json(db.getAdvancedStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4b. Channels Management (shared channels.json for sponsor rotation)
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

// 5. Broadcaster
let currentBroadcast = {
  total: 0,
  sent: 0,
  failed: 0,
  status: 'idle',
  logs: []
};

router.get('/broadcast', (req, res) => {
  res.json(currentBroadcast);
});

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
    return res.status(400).json({ error: 'Botda a\'zolar topilmadi.' });
  }

  currentBroadcast = {
    total: users.length,
    sent: 0,
    failed: 0,
    status: 'running',
    logs: [`Reklama tarqatish boshlandi: ${new Date().toLocaleTimeString()}`]
  };

  res.json({ success: true, message: 'Broadcasting started.', progress: currentBroadcast });

  const botStatus = bot.getBotStatus();
  if (!botStatus.running || !bot.getBotInstance()) {
    currentBroadcast.status = 'failed';
    currentBroadcast.logs.push('Xatolik: Telegram bot faol emas.');
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
      currentBroadcast.logs.push(`Foydalanuvchi ${user.id}: ${err.message}`);
    }
  }, 40);
});

// 6. Request Endpoints
router.get('/requests', (req, res) => {
  res.json(db.getRequests());
});

router.post('/requests/:id/complete', (req, res) => {
  const { id } = req.params;
  const completed = db.completeRequest(id);
  if (completed) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Buyurtma topilmadi.' });
  }
});

router.post('/requests/:id/complete', (req, res) => {
  const { id } = req.params;
  const completed = db.completeRequest(id);
  if (completed) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Buyurtma topilmadi.' });
  }
});

router.delete('/requests/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteRequest(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Buyurtma topilmadi.' });
  }
});

module.exports = router;
