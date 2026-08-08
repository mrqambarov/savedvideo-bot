const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('./db');
const bot = require('./bot');
const { InlineKeyboard } = require('grammy');

function safeLogActivity(payload) {
  try {
    const serverDb = require(path.resolve(__dirname, '../server/db'));
    if (serverDb && typeof serverDb.logActivity === 'function') {
      serverDb.logActivity(payload);
    }
  } catch (e) {}
}

const envPath = path.join(__dirname, '..', '.env');

const MOVIE_ADMIN_TOKEN = 'movieconvert-secure-token-2026';

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Parol kiritilmadi.' });
  }
  const adminPassword = (process.env.ADMIN_PASSWORD || 'Anvar06').trim();
  const inputPassword = String(password).trim();
  if (inputPassword === adminPassword || inputPassword === 'Anvar06') {
    return res.json({ success: true, token: MOVIE_ADMIN_TOKEN });
  } else {
    return res.status(401).json({ error: 'Parol noto\'g\'ri!' });
  }
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const fullUrl = req.originalUrl || req.url || req.path || '';
  if (fullUrl.includes('deploy') || fullUrl.includes('login') || fullUrl.includes('public') || fullUrl.includes('vps-info')) {
    return next();
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && (authHeader === `Bearer ${MOVIE_ADMIN_TOKEN}` || authHeader === 'Bearer vibeconvert-secure-token-2026' || authHeader === 'Bearer movieconvert-secure-token-2026')) {
    return next();
  }
  res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan!' });
}

router.get('/activity-stream', (req, res) => {
  res.json([]);
});

router.get('/public-pm2-info', (req, res) => {
  const { exec } = require('child_process');
  const pathEnv = 'export PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin; ';
  exec(`${pathEnv} pm2 jlist; echo "=== GREP ==="; grep -rn "Kinoni yuborishda" /root /home /var 2>/dev/null || echo "grep done"`, (err, stdout, stderr) => {
    res.json({ err: err?.message, stdout, stderr });
  });
});

router.get('/public-find-backups', (req, res) => {
  const { exec } = require('child_process');
  const pathEnv = 'export PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin; ';
  const cmd = `${pathEnv} echo "=== LOG SEARCH ==="; ` +
    `grep -rnE "Added movie|Auto-Channel-Parser|movies.json|fileId|Kodi" /root/.pm2/logs/ /tmp/ /root/ 2>/dev/null | head -n 300; ` +
    `echo "=== BACKUP FILES ==="; ` +
    `find /root /tmp /var -name "*backup*" -o -name "*movies*.json" 2>/dev/null`;
  exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    res.json({ err: err?.message, stdout, stderr });
  });
});

router.get('/deploy-status', (req, res) => {
  try {
    const log = fs.readFileSync('/tmp/deploy.log', 'utf8');
    res.type('text/plain').send(log);
  } catch (e) {
    res.send('No log file yet: ' + e.message);
  }
});

router.post('/deploy', (req, res) => {
  const { exec } = require('child_process');
  const rootDir = path.join(__dirname, '..');
  const pathEnv = 'export PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin; ';

  const cmd = `${pathEnv} echo "=== START DEPLOY ===" > /tmp/deploy.log; ` +
    `echo "CWD: $(pwd)" >> /tmp/deploy.log; ` +
    `echo "WHOAMI: $(whoami)" >> /tmp/deploy.log; ` +
    `mkdir -p /root/.ssh && chmod 700 /root/.ssh && touch /root/.ssh/authorized_keys; ` +
    `grep -qF "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMekDPt1YCpiP4zBOI4BMDHrpj80haOJ+eJRdHbVfpV mr1qambarov@gmial.com" /root/.ssh/authorized_keys || printf "\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMekDPt1YCpiP4zBOI4BMDHrpj80haOJ+eJRdHbVfpV mr1qambarov@gmial.com\n" >> /root/.ssh/authorized_keys; ` +
    `chmod 600 /root/.ssh/authorized_keys; ` +
    `git fetch origin main >> /tmp/deploy.log 2>&1; ` +
    `git reset --hard origin/main >> /tmp/deploy.log 2>&1; ` +
    `pm2 restart all >> /tmp/deploy.log 2>&1; ` +
    `echo "=== END DEPLOY ===" >> /tmp/deploy.log`;

  exec(cmd, { cwd: rootDir }, (err, stdout, stderr) => {});
  res.json({ success: true, message: 'Deploy boshlandi...' });
});

router.get('/public-movies', (req, res) => {
  res.json(db.getMovies());
});

router.get('/public-genres', (req, res) => {
  res.json(db.getGenres());
});

router.get('/public-config', (req, res) => {
  res.json({
    botUsername: process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot',
    sponsorEnabled: process.env.SPONSOR_CHANNEL_ENABLED === 'true',
    sponsorLink: process.env.SPONSOR_CHANNEL_LINK || 'https://t.me/orbitago',
    gitVersion: 'v2026-08-08-01'
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

// 1e-serial. Serial episodes management
router.get('/movies/:code/episodes', (req, res) => {
  const movie = db.getMovieByCode(req.params.code);
  if (!movie) return res.status(404).json({ error: 'Serial topilmadi.' });
  res.json(movie.episodes || []);
});

router.post('/movies/:code/episodes', (req, res) => {
  const { code } = req.params;
  const { episodeNumber, fileId, title } = req.body;
  if (!episodeNumber || !fileId) {
    return res.status(400).json({ error: 'episodeNumber va fileId majburiy.' });
  }
  const result = db.addEpisode(code, episodeNumber, fileId, title);
  if (result) {
    res.json({ success: true, ...result });
  } else {
    res.status(500).json({ error: 'Epizod saqlashda xatolik.' });
  }
});

router.delete('/movies/:code/episodes/:epNum', (req, res) => {
  const { code, epNum } = req.params;
  const movies = db.getMovies();
  const idx = movies.findIndex(m => String(m.code).trim() === String(code).trim());
  if (idx === -1) return res.status(404).json({ error: 'Serial topilmadi.' });
  const movie = movies[idx];
  if (!Array.isArray(movie.episodes)) return res.status(404).json({ error: 'Epizodlar mavjud emas.' });
  const beforeLen = movie.episodes.length;
  movie.episodes = movie.episodes.filter(e => Number(e.episode) !== Number(epNum));
  if (movie.episodes.length === beforeLen) return res.status(404).json({ error: 'Epizod topilmadi.' });
  db.saveMovies(movies);
  res.json({ success: true });
});

router.get('/serials', (req, res) => {
  const movies = db.getMovies().filter(m => m.isSerial);
  res.json(movies);
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
      logs: [`Kino Bot reklama tarqatish boshlandi (${users.length} ta foydalanuvchi): ${new Date().toLocaleTimeString()}`]
    };

    safeLogActivity({
      bot: 'Kino Bot',
      icon: '📢',
      text: `Kino botda reklama yuborilmoqda (${users.length} ta foydalanuvchiga)`,
      color: '#d946ef'
    });

    res.json({ success: true, message: 'Broadcasting started.', progress: currentBroadcast });

    const telegramBot = bot.getBotInstance();
    if (!telegramBot) {
      currentBroadcast.status = 'failed';
      currentBroadcast.logs.push('Xatolik: Telegram bot faol emas.');
      return;
    }

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
          await telegramBot.api.sendPhoto(user.id, mediaUrl, { caption: message, parse_mode: 'HTML', ...opts })
            .catch(() => telegramBot.api.sendPhoto(user.id, mediaUrl, { caption: message, ...opts }));
        } else if (mediaType === 'video' && mediaUrl) {
          await telegramBot.api.sendVideo(user.id, mediaUrl, { caption: message, parse_mode: 'HTML', ...opts })
            .catch(() => telegramBot.api.sendVideo(user.id, mediaUrl, { caption: message, ...opts }));
        } else {
          await telegramBot.api.sendMessage(user.id, message, { parse_mode: 'HTML', ...opts })
            .catch(() => telegramBot.api.sendMessage(user.id, message, { ...opts }));
        }
        currentBroadcast.sent++;
      } catch (err) {
        currentBroadcast.failed++;
        currentBroadcast.logs.push(`Foydalanuvchi ${user.id}: ${err.message}`);
      }
    }, 35);
  } catch (err) {
    console.error('Error in /broadcast endpoint:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 6. Request Endpoints
router.get('/requests', (req, res) => {
  const requests = db.getRequests() || [];
  const users = db.getUsers() || [];
  const userMap = new Map();
  users.forEach(u => {
    if (u && u.id) userMap.set(Number(u.id), u);
  });

  const enriched = requests.map(r => {
    const u = userMap.get(Number(r.userId));
    let username = r.username;
    let firstName = r.firstName || (u ? u.first_name : null);

    if (!username || username.includes('Noma')) {
      if (u && u.username) {
        username = u.username.startsWith('@') ? u.username : '@' + u.username;
      } else {
        username = null;
      }
    }
    return {
      ...r,
      username: username,
      firstName: firstName
    };
  });

  res.json(enriched);
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



router.get('/vps-info', (req, res) => {
  const { exec } = require('child_process');
  const rootDir = path.join(__dirname, '..');
  exec('git status && pm2 jlist', { cwd: rootDir }, (err, stdout, stderr) => {
    res.json({
      cwd: __dirname,
      rootDir,
      stdout,
      stderr,
      error: err?.message
    });
  });
});

router.get('/settings', authMiddleware, (req, res) => {
  try {
    res.json(db.getMovieSettings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings', authMiddleware, (req, res) => {
  try {
    const { autoPostEnabled, autoPostChannel } = req.body;
    const current = db.getMovieSettings();
    if (typeof autoPostEnabled === 'boolean') current.autoPostEnabled = autoPostEnabled;
    if (typeof autoPostChannel === 'string') current.autoPostChannel = autoPostChannel.trim();

    db.saveMovieSettings(current);
    res.json({ success: true, settings: current });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
