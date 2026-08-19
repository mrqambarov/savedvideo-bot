const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const bot = require('./bot');

const MOVIE_ADMIN_TOKEN = 'movieconvert-secure-token-2026';

// Setup uploads directory for shorts & media
const localShortsUploads = path.join(__dirname, '../public-site/uploads/shorts');
const vpsShortsUploads = '/var/www/xitfilm/uploads/shorts';
const localPostersUploads = path.join(__dirname, '../public-site/uploads/posters');
const vpsPostersUploads = '/var/www/xitfilm/uploads/posters';

function getTargetUploadDir(type = 'shorts') {
  const isVps = fs.existsSync('/var/www/xitfilm');
  const dir = type === 'posters'
    ? (isVps ? vpsPostersUploads : localPostersUploads)
    : (isVps ? vpsShortsUploads : localShortsUploads);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isPoster = file.mimetype.startsWith('image/');
    cb(null, getTargetUploadDir(isPoster ? 'posters' : 'shorts'));
  },
  filename: (req, file, cb) => {
    const isPoster = file.mimetype.startsWith('image/');
    const ext = path.extname(file.originalname).toLowerCase() || (isPoster ? '.jpg' : '.mp4');
    const prefix = isPoster ? 'poster_' : 'short_';
    const cleanName = `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    cb(null, cleanName);
  }
});

const uploadMedia = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB
});

// TMDB server-side proxy cache
const TMDB_CACHE = new Map();
const TMDB_API_KEY = process.env.TMDB_API_KEY || '8d927d7222384a86b3e83955d140e698';

router.use(express.json());

// Direct Video & Poster Upload Endpoints
router.post('/upload-short-video', uploadMedia.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Video fayl yuklanmadi!' });
    const isPoster = req.file.mimetype.startsWith('image/');
    const fileUrl = isPoster ? `/uploads/posters/${req.file.filename}` : `/uploads/shorts/${req.file.filename}`;

    // Sync to local public-site folder if directory exists
    const targetLocal = isPoster ? path.join(localPostersUploads, req.file.filename) : path.join(localShortsUploads, req.file.filename);
    if (req.file.path !== targetLocal) {
      try {
        const localDir = isPoster ? localPostersUploads : localShortsUploads;
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        fs.copyFileSync(req.file.path, targetLocal);
      } catch (e) {}
    }

    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload-poster', uploadMedia.single('poster'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Rasm fayli yuklanmadi!' });
    const fileUrl = `/uploads/posters/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  if (adminPassword && String(password).trim() === adminPassword) {
    return res.json({ success: true, token: MOVIE_ADMIN_TOKEN });
  } else {
    return res.status(401).json({ error: 'Parol noto\'g\'ri!' });
  }
});

function authMiddleware(req, res, next) {
  const fullUrl = req.originalUrl || req.path || '';
  if (fullUrl.includes('login') || fullUrl.includes('public')) return next();
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return next();
  res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan!' });
}

// ========================================
// Public API
// ========================================
router.get('/public-movies', (req, res) => res.json(db.getMovies()));
router.get('/public-genres', (req, res) => res.json(db.getGenres()));

router.post('/public-movie/:code/view', (req, res) => {
    try {
        const code = req.params.code;
        const uid = req.body?.userId || req.headers['x-user-id'] || null;
        if (code) {
            db.trackMovieView(code, uid);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dynamic SEO Sitemap endpoint
router.get(['/public-sitemap.xml', '/sitemap.xml'], (req, res) => {
    try {
        const sitemapPath = path.join(__dirname, '..', 'public-site', 'sitemap.xml');
        if (fs.existsSync(sitemapPath)) {
            res.header('Content-Type', 'application/xml');
            return res.sendFile(sitemapPath);
        }
        
        // Fallback generator
        const movies = db.getMovies() || [];
        const today = new Date().toISOString().split('T')[0];
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        xml += `  <url><loc>https://xitfilm.uz/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
        movies.forEach(m => {
            xml += `  <url><loc>https://xitfilm.uz/?code=${m.code}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
        });
        xml += `</urlset>`;
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (e) {
        res.status(500).send('Error generating sitemap');
    }
});

router.post('/public-verify-code', (req, res) => {
    const user = db.verifyAuthCode(req.body.code);
    if (user) res.json({ success: true, user });
    else res.status(401).json({ error: 'Xato' });
});

router.get('/public-check-login/:token', (req, res) => {
    const user = db.checkLinkLogin(req.params.token);
    if (user) res.json({ success: true, user });
    else res.json({ success: false });
});

router.get('/public-user-data/:userId', (req, res) => {
    const userId = req.params.userId;
    const favorites = db.getFavorites(userId);
    // Simple mock for history if not strictly in db yet, or get from users.json if syncUserActivity was used
    const users = db.getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    const historyCodes = (user && user.watchHistory) ? user.watchHistory : [];
    const movies = db.getMovies();
    const history = historyCodes.map(c => movies.find(m => m.code === c)).filter(Boolean);

    res.json({
        favorites,
        history,
        isPremium: user ? !!user.isPremium : false,
        premiumUntil: user ? user.premiumUntil : null,
        user: user ? { id: user.id, first_name: user.first_name, username: user.username } : null
    });
});

router.post('/public-sync', (req, res) => {
    const { userId, favorite, history } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const result = db.syncUserActivity(userId, { favorite, history });
    res.json({ success: !!result });
});

router.post('/public-toggle-fav', (req, res) => {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'Missing data' });
    const isFav = db.toggleFavorite(userId, code);
    res.json({ success: true, favorited: isFav });
});

// Save movie playback progress (Continue Watching)
router.post('/public-playback-progress', (req, res) => {
    const { userId, code, currentTime, duration, title, poster, genre } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const uid = userId || req.headers['x-user-id'] || 'guest';
    const result = db.savePlaybackProgress(uid, code, { currentTime, duration, title, poster, genre });
    res.json({ success: true, progress: result });
});

// Get continue-watching list for user
router.get('/public-playback-progress/:userId', (req, res) => {
    const userId = req.params.userId;
    const progressList = db.getPlaybackProgress(userId);
    res.json({ success: true, items: progressList });
});

// ========================================
// SHORTS & CREATORS PUBLIC API (ALGORITHMIC)
// ========================================
router.get('/public-shorts', (req, res) => {
    try {
        const feedType = req.query.feed || 'foryou';
        const genre = req.query.genre || null;
        const userId = req.query.userId || req.headers['x-user-id'] || null;

        const shorts = db.getAlgorithmicShorts({ feedType, genre, userId });
        res.json({ success: true, shorts, feedType });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/public-shorts/:id/view', (req, res) => {
    const views = db.incrementShortViews(req.params.id, req.body.ref);
    res.json({ success: true, views });
});

router.post('/public-shorts/:id/interaction', (req, res) => {
    const result = db.recordShortInteraction(req.params.id, req.body);
    res.json({ success: !!result, ...result });
});

router.post('/public-shorts/:id/bookmark', (req, res) => {
    const uid = req.body.userId || req.headers['x-user-id'] || 'guest';
    const result = db.toggleShortBookmark(req.params.id, uid);
    res.json({ success: true, ...result });
});

router.get('/public-creator/:tag', (req, res) => {
    const uid = req.query.userId || req.headers['x-user-id'] || null;
    const profile = db.getCreatorFullProfile(req.params.tag, uid);
    if (!profile) return res.status(404).json({ error: 'Creator topilmadi' });
    res.json({ success: true, profile });
});

router.post('/public-creator/:tag/follow', (req, res) => {
    const uid = req.body.userId || req.headers['x-user-id'] || 'guest';
    const result = db.toggleCreatorFollow(req.params.tag, uid);
    res.json({ success: true, ...result });
});

router.get('/public-shorts/bookmarked/:userId', (req, res) => {
    const items = db.getUserBookmarkedShorts(req.params.userId);
    res.json({ success: true, shorts: items });
});

router.post('/public-shorts/:id/like', (req, res) => {
    const uid = req.body.userId || req.headers['x-user-id'] || 'guest_' + Math.random().toString(36).substring(2, 6);
    const result = db.toggleShortLike(req.params.id, uid);
    res.json({ success: true, ...result });
});

router.get('/public-shorts/:id/comments', (req, res) => {
    const comments = db.getShortComments(req.params.id);
    res.json({ success: true, comments });
});

router.post('/public-shorts/:id/comments', (req, res) => {
    const comment = db.addShortComment(req.params.id, req.body);
    if (!comment) return res.status(400).json({ error: 'Izoh kiritishda xatolik' });
    res.json({ success: true, comment });
});

router.post('/public-creator-register', (req, res) => {
    const { name, username, telegramId, phone } = req.body;
    if (!username && !name) return res.status(400).json({ error: 'Ma\'lumotlar to\'liq emas' });
    const result = db.registerCreator({ name, username, telegramId, phone });
    if (!result) return res.status(500).json({ error: 'Ro\'yxatdan o\'tishda xatolik' });
    res.json({ success: true, ...result });
});

router.get('/public-creator-stats/:creatorId', (req, res) => {
    const stats = db.getCreatorStats(req.params.creatorId);
    if (!stats) return res.status(404).json({ error: 'Hamkor topilmadi' });
    res.json({ success: true, ...stats });
});

router.post('/public-creator-upload-short', (req, res) => {
    const { title, description, videoUrl, poster, duration, movieCode, movieTitle, creatorId, creatorName, creatorTag } = req.body;
    if (!videoUrl || !movieCode) return res.status(400).json({ error: 'Video havola va kino kodi shart!' });
    
    const newShort = db.addShort({
        title,
        description,
        videoUrl,
        poster,
        duration,
        movieCode,
        movieTitle,
        creatorId: creatorId || 'cre_official',
        creatorName: creatorName || 'Hamkor Creator',
        creatorTag: creatorTag || '@creator',
        status: 'active'
    });
    res.json({ success: !!newShort, short: newShort });
});

// On-site movie request
router.post('/public-request', (req, res) => {
    const { title, comment, userId, contact } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Kino nomi kiritilmadi' });
    }
    const cleanTitle = title.trim();
    const reqComment = comment ? ` (${comment.trim()})` : '';
    const requester = contact || userId || 'Sayt Foydalanuvchisi';
    const result = db.addRequest(`${cleanTitle}${reqComment}`, userId || 0, requester);
    
    // Log activity
    try {
        const serverDb = require(require('path').resolve(__dirname, '../server/db'));
        if (serverDb && typeof serverDb.logActivity === 'function') {
            serverDb.logActivity({
                bot: 'Public Web',
                type: 'user',
                actor: requester,
                icon: '🍿',
                text: `Saytdan kino so'raldi: '${cleanTitle}'`,
                color: '#38bdf8'
            });
        }
    } catch (e) {}

    res.json({ success: true, message: 'Kino buyurtmangiz qabul qilindi!', request: result });
});

// ========================================
// TMDB Proxy (Server-side with cache)
// ========================================
router.get('/public-tmdb/:title', async (req, res) => {
    const title = req.params.title;
    if (!title) return res.status(400).json({ error: 'Missing title' });

    // Check cache (1 hour TTL)
    const cached = TMDB_CACHE.get(title);
    if (cached && Date.now() - cached.time < 3600000) {
        return res.json(cached.data);
    }

    try {
        const axios = require('axios');
        const tmdbRes = await axios.get(
            `https://api.themoviedb.org/3/search/movie`,
            {
                params: { api_key: TMDB_API_KEY, query: title, language: 'ru-RU' },
                timeout: 5000
            }
        );
        const data = tmdbRes.data;
        const result = data.results && data.results[0] ? data.results[0] : null;

        TMDB_CACHE.set(title, { data: result, time: Date.now() });

        // Keep cache size manageable
        if (TMDB_CACHE.size > 1000) {
            const firstKey = TMDB_CACHE.keys().next().value;
            TMDB_CACHE.delete(firstKey);
        }

        res.json(result);
    } catch (err) {
        // Return null gracefully without breaking client UI
        res.json(null);
    }
});

router.get('/public-reviews/:code', (req, res) => {
    const code = req.params.code;
    res.json(db.getMovieReviews(code));
});

router.post('/public-reviews/:code', (req, res) => {
    const code = req.params.code;
    const { name, rating, comment } = req.body || {};
    const result = db.addMovieReview(code, { name, rating, comment });
    if (result) res.json({ success: true, ...result });
    else res.status(500).json({ error: 'Review could not be added' });
});

router.post('/public-upgrade-vip', (req, res) => {
    const { userId, days } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const success = db.upgradeUserToPremium(userId, days || 30);
    res.json({ success });
});

router.post('/public-apply-promo', (req, res) => {
    const { userId, promoCode } = req.body;
    if (!userId || !promoCode) return res.status(400).json({ success: false, message: 'Ma\'lumotlar yetarli emas' });
    const result = db.applyPromoCode(userId, promoCode);
    res.json(result);
});

router.get('/movie/:code', (req, res) => {
    const code = req.params.code;
    const movie = db.getMovieByCode(code);
    const publicDir = path.join(__dirname, '..', 'public-site');
    let htmlPath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(htmlPath)) {
        return res.status(404).send('Site index.html not found');
    }

    let html = fs.readFileSync(htmlPath, 'utf8');
    if (movie) {
        try { db.trackMovieView(code); } catch (e) {}
        const title = `${movie.title} — XIT FILM`;
        const desc = movie.description || 'XIT FILM portalida sara filmlarni professional tarjimada va yuqori sifatda tomosha qiling.';
        const poster = movie.poster || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop';
        
        html = html.replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`);
        
        if (html.includes('property="og:title"')) {
            html = html.replace(/<meta property="og:title" content=".*?"/gi, `<meta property="og:title" content="${title}"`);
        } else {
            html = html.replace('</head>', `<meta property="og:title" content="${title}">\n</head>`);
        }
        
        if (html.includes('property="og:description"')) {
            html = html.replace(/<meta property="og:description" content=".*?"/gi, `<meta property="og:description" content="${desc}"`);
        } else {
            html = html.replace('</head>', `<meta property="og:description" content="${desc}">\n</head>`);
        }

        if (html.includes('property="og:image"')) {
            html = html.replace(/<meta property="og:image" content=".*?"/gi, `<meta property="og:image" content="${poster}"`);
        } else {
            html = html.replace('</head>', `<meta property="og:image" content="${poster}">\n</head>`);
        }

        if (html.includes('name="description"')) {
            html = html.replace(/<meta name="description" content=".*?"/gi, `<meta name="description" content="${desc}"`);
        } else {
            html = html.replace('</head>', `<meta name="description" content="${desc}">\n</head>`);
        }
    }
    res.send(html);
});

// ========================================
// Admin API
// ========================================
router.use(authMiddleware);
router.get('/movies', (req, res) => res.json(db.getMovies()));
router.get('/users', (req, res) => res.json(db.getUsers()));
router.get('/stats', (req, res) => res.json(db.getAdvancedStats()));
router.get('/search-analytics', (req, res) => {
  try {
    const movies = db.getMovies() || [];
    const sorted = [...movies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    const topSearches = sorted.map(m => ({ query: m.title || m.code, count: m.views || 0 }));
    res.json({ topSearches, topMovies: sorted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router.get('/bot-status', (req, res) => res.json({ running: true, botUsername: process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot' }));
router.post('/bot-status', (req, res) => res.json({ success: true, status: { running: req.body?.action !== 'stop' } }));

router.get('/config', (req, res) => {
  try {
    const settings = db.getMovieSettings() || {};
    const channels = settings.sponsorChannels || [
      { username: settings.sponsorUsername || '@XitFilm_uz', link: settings.sponsorLink || 'https://t.me/XitFilm_uz', title: '1-Homiy Kanal' }
    ];
    res.json({
      botToken: process.env.MOVIE_BOT_TOKEN || '',
      sponsorUsername: channels[0]?.username || '@XitFilm_uz',
      sponsorLink: channels[0]?.link || 'https://t.me/XitFilm_uz',
      sponsorChannels: channels,
      sponsorEnabled: settings.sponsorEnabled ?? true,
      adminIds: process.env.ADMIN_IDS || '6263659922, 5839622003'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/config', (req, res) => {
  try {
    const { sponsorChannels, sponsorUsername, sponsorLink, botToken, adminIds, sponsorEnabled } = req.body;
    const current = db.getMovieSettings() || {};
    if (Array.isArray(sponsorChannels)) current.sponsorChannels = sponsorChannels;
    if (sponsorUsername) current.sponsorUsername = sponsorUsername;
    if (sponsorLink) current.sponsorLink = sponsorLink;
    if (sponsorEnabled !== undefined) current.sponsorEnabled = Boolean(sponsorEnabled);
    db.saveMovieSettings(current);
    if (botToken) process.env.MOVIE_BOT_TOKEN = botToken;
    if (adminIds) process.env.ADMIN_IDS = adminIds;
    res.json({ success: true, message: 'Kino Bot sozlamalari saqlandi!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/settings', (req, res) => {
  try {
    const settings = db.getMovieSettings() || {};
    res.json({
      autoPostEnabled: settings.autoPostEnabled ?? true,
      autoPostChannel: settings.autoPostChannel || '@XitFilm_uz'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings', (req, res) => {
  try {
    const { autoPostEnabled, autoPostChannel } = req.body;
    const current = db.getMovieSettings() || {};
    current.autoPostEnabled = !!autoPostEnabled;
    current.autoPostChannel = autoPostChannel || '';
    db.saveMovieSettings(current);
    res.json({ success: true, message: 'Avto-post sozlamalari saqlandi!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function publishMovieToChannel(movie, targetChannel) {
  try {
    const botInstance = bot.getBotInstance();
    const settings = db.getMovieSettings() || {};
    const channel = targetChannel || settings.autoPostChannel || process.env.AUTO_POST_CHANNEL || '@XitFilm_uz';
    if (!botInstance || !channel) return false;

    const cleanChannel = channel.startsWith('@') ? channel : '@' + channel;
    const botUsername = botInstance.botInfo?.username || process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
    const mCode = String(movie.code).trim();
    const miniAppUrl = `https://xitfilm.uz?code=${mCode}&tma=1&v=4.2.0`;

    const { InlineKeyboard } = require('grammy');
    const kb = new InlineKeyboard()
      .webApp('🎬 Ilovada Tomosha Qilish (4K)', miniAppUrl)
      .row()
      .url('🍿 Bot Orqali Yuklab Olish', `https://t.me/${botUsername}?start=${mCode}`);

    const desc = movie.description
      ? (movie.description.length > 250 ? movie.description.substring(0, 247) + '...' : movie.description)
      : 'Eng sara tarjima kinolar va shov-shuvli premyerani yuqori sifatda tomosha qiling!';

    const postCaption =
      `🔥 <b>YANGI PREMYERA: ${movie.title.toUpperCase()}</b> 🔥\n\n` +
      `📁 <b>Janr:</b> #${(movie.genre || 'Kino').replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '_')}\n` +
      `🔑 <b>Kino Kodi:</b> <code>${mCode}</code>\n\n` +
      `📝 <i>${desc}</i>\n\n` +
      `🍿 <b>Ko'rish yoki yuklab olish uchun pastdagi tugmalarni bosing:</b>\n` +
      `👉 <b>Bizning bot:</b> @${botUsername}`;

    if (movie.poster && movie.poster.startsWith('http')) {
      await botInstance.api.sendPhoto(cleanChannel, movie.poster, {
        caption: postCaption,
        parse_mode: 'HTML',
        reply_markup: kb
      });
    } else {
      await botInstance.api.sendMessage(cleanChannel, postCaption, {
        parse_mode: 'HTML',
        reply_markup: kb
      });
    }
    return true;
  } catch (err) {
    console.error('Channel auto-post error:', err.message);
    return false;
  }
}

router.post('/movies', async (req, res) => {
  const { code, title, description, fileId, genre, poster, notify, type, videoUrl } = req.body;
  const movie = db.addMovie({ code, title, description, fileId, genre, poster, type, videoUrl });
  
  if (movie) {
    if (notify) {
      bot.notifyNewMovie(movie).catch(e => console.error(e));
    }

    // Auto publish to Telegram channel if enabled
    const settings = db.getMovieSettings() || {};
    if (settings.autoPostEnabled) {
      publishMovieToChannel(movie).catch(e => console.error('Auto channel publish error:', e.message));
    }

    // Auto notify Premyera Alert subscribers who were waiting for this movie
    try {
      const waiting = db.getWaitingUsersForMovie(movie.title);
      if (waiting && waiting.userIds && waiting.userIds.length > 0) {
        const botInstance = bot.getBotInstance();
        if (botInstance) {
          const mCode = String(movie.code).trim();
          const cleanTitle = movie.title;
          const miniAppUrl = `https://xitfilm.uz?code=${mCode}&tma=1&v=4.2.0`;
          const { InlineKeyboard } = require('grammy');
          const kb = new InlineKeyboard()
            .webApp('📱 Ilovada ko\'rish (HD)', miniAppUrl)
            .row()
            .url('🍿 Botda yuklab olish', `https://t.me/${botInstance.botInfo?.username || 'xitfilm_bot'}?start=${mCode}`);

          for (const uid of waiting.userIds) {
            try {
              await botInstance.api.sendMessage(
                uid,
                `🎉 <b>Xushxabar! Siz kutgan film chiqdi!</b>\n\n` +
                `🎬 <b>«${cleanTitle}»</b> filmi XIT FILM kinoteatri bazasiga qo'shildi!\n` +
                `🔑 Kod: <code>${mCode}</code>\n\n` +
                `<i>Hoziroq yuqori HD formatda tomosha qiling:</i>`,
                { parse_mode: 'HTML', reply_markup: kb }
              );
            } catch (err) {}
          }
          db.removeMovieAlert(null, movie.title);
        }
      }
    } catch (e) {
      console.error('Alert notify error:', e.message);
    }
  }

  res.json({ success: !!movie, movie });
});

router.post('/movies/:code/publish-channel', async (req, res) => {
  try {
    const movie = db.getMovieByCode(req.params.code);
    if (!movie) return res.status(404).json({ error: 'Kino topilmadi' });
    const success = await publishMovieToChannel(movie, req.body.channel);
    if (success) {
      res.json({ success: true, message: 'Kino kanalga muvaffaqiyatli post qilindi!' });
    } else {
      res.status(500).json({ error: 'Kanalga post qilishda xatolik yuz berdi. Kanal username va bot adminligini tekshiring.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/movies/:code', (req, res) => res.json({ success: db.deleteMovie(req.params.code) }));

// Sponsor Channels CRUD
router.get('/sponsor-channels', (req, res) => {
  res.json({ success: true, channels: db.getSponsorChannels() });
});

router.post('/sponsor-channels', (req, res) => {
  const { username, link, title } = req.body;
  if (!username) return res.status(400).json({ error: 'Username kiritilmadi' });
  const ok = db.addSponsorChannel({ username, link, title });
  res.json({ success: ok, channels: db.getSponsorChannels() });
});

router.delete('/sponsor-channels/:username', (req, res) => {
  const ok = db.deleteSponsorChannel(req.params.username);
  res.json({ success: ok, channels: db.getSponsorChannels() });
});

// Admin Shorts & Creators Management
router.get('/shorts', (req, res) => {
  res.json({ success: true, shorts: db.getShorts() });
});

router.post('/shorts', (req, res) => {
  const short = db.addShort(req.body);
  res.json({ success: !!short, short });
});

router.put('/shorts/:id', (req, res) => {
  const short = db.updateShort(req.params.id, req.body);
  res.json({ success: !!short, short });
});

router.delete('/shorts/:id', (req, res) => {
  const ok = db.deleteShort(req.params.id);
  res.json({ success: ok });
});

router.get('/creators', (req, res) => {
  res.json({ success: true, creators: db.getCreators() });
});

router.get('/search-analytics', (req, res) => {
  try {
    const data = db.getSearchAnalytics ? db.getSearchAnalytics() : { totalUnique: 0, top: [], noResults: [] };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
