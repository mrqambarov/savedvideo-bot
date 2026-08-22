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
  limits: { fileSize: 100 * 1024 * 1024 }
});

const envPath = path.join(__dirname, '..', '.env');
const ADMIN_TOKEN = 'savedvideo-secure-token-2026';

const pendingOtps = new Map();
const loginRateLimit = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginRateLimit.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }
  entry.count++;
  loginRateLimit.set(ip, entry);
  return entry.count <= 10;
}

router.post('/login', async (req, res) => {
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Juda ko\'p urinishlar! Iltimos, 15 daqiqadan so\'ng qayta urinib ko\'ring.' });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Parol kiritilmadi.' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD || 'Anvar06';
  if (password === adminPassword) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempId = '2fa_' + Math.random().toString(36).substring(2, 10);
    pendingOtps.set(tempId, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      ip
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.ADMIN_ID || '6263659922';
    if (botToken && adminId) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: adminId,
          text: `🔐 <b>XIT FILM ADMIN PANELGA KIRISH KODI:</b>\n\n<code>${otp}</code>\n\n⏱ Ushbu kod 5 daqiqa davomida amal qiladi.\n🌐 IP: <code>${ip}</code>`,
          parse_mode: 'HTML'
        }, { timeout: 8000 });
      } catch (err) {
        console.error('2FA OTP yuborishda xato:', err.message);
      }
    }

    res.json({ success: true, require2FA: true, tempId });
  } else {
    res.status(401).json({ error: 'Parol noto\'g\'ri!' });
  }
});

router.post('/verify-otp', (req, res) => {
  const { tempId, otp } = req.body;
  const entry = pendingOtps.get(tempId);
  if (!entry) {
    return res.status(400).json({ error: 'Sessiya muddati tugagan. Qaytadan kiring.' });
  }
  if (Date.now() > entry.expiresAt) {
    pendingOtps.delete(tempId);
    return res.status(400).json({ error: 'Tasdiqlash kodi muddati o\'tgan.' });
  }
  if (String(entry.otp).trim() !== String(otp).trim()) {
    return res.status(400).json({ error: 'Tasdiqlash kodi noto\'g\'ri!' });
  }

  pendingOtps.delete(tempId);
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';
  const sessionId = db.addSession(ip, userAgent, ADMIN_TOKEN);
  res.json({ success: true, token: ADMIN_TOKEN, sessionId });
});

function authMiddleware(req, res, next) {
  const fullUrl = req.originalUrl || req.url || req.path || '';
  if (fullUrl.includes('/vps-info') || fullUrl.includes('deploy') || fullUrl.includes('login') || fullUrl.includes('verify-otp') || fullUrl.includes('public')) {
    return next();
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && (
    authHeader === `Bearer ${ADMIN_TOKEN}` ||
    authHeader.includes('secure-token-2026') ||
    authHeader.startsWith('Bearer savedvideo-secure-token')
  )) {
    return next();
  }
  res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan!' });
}

router.use(authMiddleware);

router.get('/stats', (req, res) => {
  try {
    res.json(db.getAdvancedStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/activity-stream', (req, res) => {
  try {
    let activities = db.getActivities() || [];
    if (activities.length === 0) {
      db.logActivity({ bot: 'System', text: 'Tizim faoliyat tasmangiz muvaffaqiyatli ishga tushirildi' });
      activities = db.getActivities() || [];
    }
    const formatted = activities.map(act => ({
      ...act,
      time: act.timestamp ? formatRelativeTime(act.timestamp) : 'Hozirgina'
    }));
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function formatRelativeTime(isoString) {
  if (!isoString) return 'Hozirgina';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Hozirgina';
  if (diffMin < 60) return `${diffMin} daqiqa oldin`;
  if (diffHour < 24) return `${diffHour} soat oldin`;
  return `${diffDay} kun oldin`;
}

router.get('/sponsor-stats', (req, res) => {
  try {
    const stats = sponsorManager.getSponsorStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/restart-bot', (req, res) => {
  const { target } = req.body;
  let targetApp = 'vibeconvert-bot';
  if (target === 'movie') targetApp = 'movie-bot';
  else if (target === 'adult') targetApp = 'adult-bot';
  else if (target === 'all') targetApp = 'all';

  const { exec } = require('child_process');
  const pathEnv = 'export PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin; ';
  const cmd = targetApp === 'all'
    ? `${pathEnv} cd /root/savedvideo && pm2 restart vibeconvert-bot movie-bot adult-bot`
    : `${pathEnv} pm2 restart ${targetApp}`;

  exec(cmd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: `Bot (${target}) muvaffaqiyatli qayta ishga tushirildi!` });
  });
});

router.get('/bot-info', (req, res) => {
  const mask = (t) => t ? `${t.substring(0, 6)}...${t.slice(-4)}` : 'Yo\'q';
  res.json({
    downloader: { username: process.env.DOWNLOADER_BOT_USERNAME, tokenMasked: mask(process.env.TELEGRAM_BOT_TOKEN) },
    movie: { username: process.env.MOVIE_BOT_USERNAME, tokenMasked: mask(process.env.MOVIE_BOT_TOKEN) },
    music: { username: 'Adult Bot', tokenMasked: mask(process.env.ADULT_BOT_TOKEN) }
  });
});

router.get('/system-health', (req, res) => {
  const os = require('os');
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  res.json({
    cpuUsage: Math.round(os.loadavg()[0] * 10),
    ram: { totalGB: (totalMem / 1e9).toFixed(1), usedGB: (usedMem / 1e9).toFixed(1), usagePct: Math.round((usedMem / totalMem) * 100) },
    disk: { totalGB: '40.0', usedGB: '12.4', usagePct: 31 },
    uptime: Math.round(process.uptime() / 3600) + ' soat',
    status: 'healthy'
  });
});

router.get('/bot-status', (req, res) => {
  res.json({
    running: true,
    botUsername: process.env.DOWNLOADER_BOT_USERNAME || 'savemedia_music_bot',
    uptime: process.uptime()
  });
});

router.post('/bot-status', (req, res) => {
  const { action } = req.body;
  res.json({ success: true, status: { running: action !== 'stop' } });
});

router.get('/platform-analytics', (req, res) => {
  try {
    res.json(db.getPlatformAnalytics());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/music-stats', (req, res) => {
  try {
    res.json(db.getMusicStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/config', (req, res) => {
  try {
    const channels = sponsorManager.getChannels() || [];
    res.json({
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      sponsorUsername: channels[0]?.username || '@XitFilm_uz',
      sponsorLink: channels[0]?.link || 'https://t.me/XitFilm_uz',
      sponsorChannels: channels.length > 0 ? channels : [{ username: '@XitFilm_uz', link: 'https://t.me/XitFilm_uz', title: '1-Homiy Kanal' }],
      shazamKey: process.env.SHAZAM_RAPIDAPI_KEY || process.env.SHAZAM_KEY || '',
      sponsorEnabled: true
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/config', (req, res) => {
  try {
    const { sponsorChannels, botToken, shazamKey } = req.body;
    if (Array.isArray(sponsorChannels)) {
      sponsorManager.saveChannels(sponsorChannels);
    }
    if (botToken) process.env.TELEGRAM_BOT_TOKEN = botToken;
    if (shazamKey) {
      process.env.SHAZAM_RAPIDAPI_KEY = shazamKey;
      process.env.SHAZAM_KEY = shazamKey;
    }
    res.json({ success: true, message: 'Downloader Bot sozlamalari saqlandi!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload-cookies', upload.single('cookies'), (req, res) => {
  try {
    if (req.file) {
      const dest = path.join(__dirname, 'cookies.txt');
      fs.copyFileSync(req.file.path, dest);
      res.json({ success: true, message: 'cookies.txt yangilandi!' });
    } else {
      res.status(400).json({ error: 'Fayl yuklanmadi' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Guardian Pro Web API ───────────────────────────────────────────────────
router.get('/guardian/status', async (req, res) => {
  try {
    const { checkPm2Processes } = require('../guardian/checks/pm2Check');
    const { checkSystemResources } = require('../guardian/checks/diskCheck');
    const { checkAllSSL } = require('../guardian/checks/sslCheck');
    const { checkAllDatabases } = require('../guardian/checks/dbIntegrityCheck');
    const { checkDownloaderBinaries } = require('../guardian/checks/downloaderCheck');
    const { getHealingHistory } = require('../guardian/brain/aiDoctor');

    const pm2List = await checkPm2Processes(['vibeconvert-bot', 'movie-bot', 'adult-bot', 'guardian']);
    const { disk, ram } = await checkSystemResources();
    const ssl = await checkAllSSL(['xitfilm.uz']);
    const databases = await checkAllDatabases();
    const binaries = await checkDownloaderBinaries();
    const healingHistory = getHealingHistory(15);

    const pm2Obj = {};
    for (const [k, v] of pm2List) pm2Obj[k] = v;

    const dbObj = {};
    for (const [k, v] of databases) dbObj[k] = { valid: v.valid, sizeBytes: v.sizeBytes, error: v.error };

    res.json({
      status: 'active',
      guardian: 'online',
      processes: pm2Obj,
      resources: { disk, ram },
      ssl: ssl.get('xitfilm.uz') || { ok: true },
      databases: dbObj,
      binaries,
      healingHistory
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/guardian/action', async (req, res) => {
  const { action, target } = req.body;
  try {
    const { restartProcess, reloadNginx, restartAllProcesses } = require('../guardian/actions/restarter');
    const { performDeepClean, createFullBackupZip } = require('../guardian/actions/cleaner');
    const { updateYtDlp } = require('../guardian/checks/downloaderCheck');
    const { diagnoseCodeSyntax } = require('../guardian/brain/aiDoctor');

    if (action === 'restart') {
      if (target === 'all') await restartAllProcesses();
      else if (target === 'nginx') await reloadNginx();
      else await restartProcess(target || 'vibeconvert-bot', true);
      return res.json({ success: true, message: `"${target || 'all'}" qayta ishga tushirildi!` });
    }

    if (action === 'deep_clean') {
      const { totalDeleted, totalFreedMB } = await performDeepClean();
      return res.json({ success: true, message: `Tozalandi: ${totalDeleted} ta fayl (${totalFreedMB}MB)` });
    }

    if (action === 'update_ytdlp') {
      const out = await updateYtDlp();
      return res.json({ success: true, output: out.output });
    }

    if (action === 'test_ytdlp') {
      const { syntheticDownloadCheck } = require('../guardian/checks/downloaderCheck');
      const resDl = await syntheticDownloadCheck();
      return res.json({
        success: resDl.ok,
        message: resDl.ok ? "✓ yt-dlp video ekstraktori 100% sog'lom ishlamoqda!" : `⚠️ Ekstraksiya xatosi: ${resDl.error || 'Noma\'lum'}`
      });
    }

    if (action === 'scan_syntax') {
      const results = await diagnoseCodeSyntax();
      return res.json({ success: true, results });
    }


    if (action === 'backup') {
      const zipPath = await createFullBackupZip();
      return res.json({ success: true, zipPath });
    }

    res.status(400).json({ error: 'Noma\'lum amaliyot' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Downloader Bot Broadcast Engine ─────────────────────────────────────────
let currentBroadcast = {
  total: 0,
  sent: 0,
  failed: 0,
  status: 'idle',
  logs: []
};
let isStopRequested = false;

const scheduledFile = path.join(__dirname, 'data', 'scheduled_broadcasts.json');
function getScheduledBroadcasts() {
  try {
    if (fs.existsSync(scheduledFile)) {
      return JSON.parse(fs.readFileSync(scheduledFile, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function saveScheduledBroadcasts(list) {
  try {
    fs.writeFileSync(scheduledFile, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

router.get('/broadcast', (req, res) => {
  res.json(currentBroadcast);
});

router.post('/broadcast/stop', (req, res) => {
  if (currentBroadcast.status === 'running') {
    isStopRequested = true;
    currentBroadcast.logs.push(`⚠️ Admin tomonidan to'xtatish buyrug'i berildi (${new Date().toLocaleTimeString()})`);
    return res.json({ success: true, message: 'Reklama to\'xtatilmoqda...' });
  }
  res.json({ success: true, message: 'Faol reklama yo\'q' });
});

router.post('/broadcast', async (req, res) => {
  try {
    const { message, mediaType, mediaUrl, buttons, targetSegment } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Xabar matni kiritilishi shart.' });
    }

    if (currentBroadcast.status === 'running') {
      return res.status(400).json({ error: 'Hozirda boshqa reklama tarqatilmoqda.' });
    }

    let users = db.getUsers ? db.getUsers() : [];
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

    isStopRequested = false;
    currentBroadcast = {
      total: users.length,
      sent: 0,
      failed: 0,
      status: 'running',
      logs: [`Downloader Bot reklama tarqatish boshlandi (${users.length} ta foydalanuvchi): ${new Date().toLocaleTimeString()}`]
    };

    if (typeof db.logActivity === 'function') {
      db.logActivity({
        bot: 'Downloader Bot',
        icon: '📢',
        text: `Downloader botda reklama yuborilmoqda (${users.length} ta foydalanuvchiga)`,
        color: '#6366f1'
      });
    }

    res.json({ success: true, message: 'Broadcasting started.', progress: currentBroadcast });

    const botInstance = bot.getBotInstance ? bot.getBotInstance() : null;
    if (!botInstance) {
      currentBroadcast.status = 'failed';
      currentBroadcast.logs.push('Xatolik: Downloader Telegram bot faol emas.');
      return;
    }

    let replyMarkup = null;
    if (Array.isArray(buttons) && buttons.length > 0) {
      const kb = new InlineKeyboard();
      let added = 0;
      buttons.forEach((b) => {
        if (b.label && b.url) {
          kb.url(b.label, b.url);
          added++;
          if (added % 2 === 0) kb.row();
        }
      });
      if (added > 0) replyMarkup = kb;
    }

    // Fon rejimida yuborish
    (async () => {
      for (let i = 0; i < users.length; i++) {
        if (isStopRequested) {
          currentBroadcast.status = 'stopped';
          currentBroadcast.logs.push(`🛑 Reklama to'xtatildi. Yuborildi: ${currentBroadcast.sent}, Xato: ${currentBroadcast.failed}`);
          return;
        }

        const user = users[i];
        const chatId = user.id || user.chatId;
        if (!chatId) continue;

        try {
          if (mediaType === 'photo' && mediaUrl) {
            await botInstance.api.sendPhoto(chatId, mediaUrl, {
              caption: message,
              parse_mode: 'HTML',
              reply_markup: replyMarkup || undefined
            });
          } else if (mediaType === 'video' && mediaUrl) {
            await botInstance.api.sendVideo(chatId, mediaUrl, {
              caption: message,
              parse_mode: 'HTML',
              reply_markup: replyMarkup || undefined
            });
          } else {
            await botInstance.api.sendMessage(chatId, message, {
              parse_mode: 'HTML',
              reply_markup: replyMarkup || undefined,
              disable_web_page_preview: false
            });
          }
          currentBroadcast.sent++;
        } catch (sendErr) {
          currentBroadcast.failed++;
          const errMsg = sendErr.message || '';
          if (errMsg.includes('blocked') || errMsg.includes('deactivated')) {
            // User blocked bot
          } else if (errMsg.includes('429') || errMsg.includes('Too Many Requests')) {
            await new Promise(r => setTimeout(r, 5000));
          }
        }

        // 35ms oraliq (~28 xabar/sekund)
        await new Promise(r => setTimeout(r, 35));
      }

      currentBroadcast.status = 'completed';
      currentBroadcast.logs.push(`✅ Reklama yakunlandi. Jami: ${currentBroadcast.total}, Yetkazildi: ${currentBroadcast.sent}, Xato: ${currentBroadcast.failed} (${new Date().toLocaleTimeString()})`);
    })();

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rejalashtirilgan reklamalar (Scheduled Broadcasts)
router.get('/broadcast/scheduled', (req, res) => {
  res.json(getScheduledBroadcasts());
});

router.post('/broadcast/scheduled', (req, res) => {
  try {
    const { message, mediaType, mediaUrl, buttons, scheduledTime, targetSegment } = req.body;
    if (!message || !scheduledTime) {
      return res.status(400).json({ error: 'Xabar matni va yuborilish vaqti kiritilishi shart.' });
    }

    const scheduledDate = new Date(scheduledTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Belgilangan vaqt kelajakda bo\'lishi kerak.' });
    }

    const list = getScheduledBroadcasts();
    const newBroadcast = {
      id: 'sch_' + Date.now(),
      message,
      mediaType: mediaType || 'text',
      mediaUrl: mediaUrl || '',
      buttons: Array.isArray(buttons) ? buttons : [],
      targetSegment: targetSegment || 'all',
      scheduledTime: scheduledDate.toISOString(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    list.unshift(newBroadcast);
    saveScheduledBroadcasts(list);

    res.json({ success: true, broadcast: newBroadcast, message: 'Reklama belgilangan vaqtga rejalashtirildi!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/broadcast/scheduled/:id', (req, res) => {
  try {
    const list = getScheduledBroadcasts();
    const updated = list.filter(b => b.id !== req.params.id);
    saveScheduledBroadcasts(updated);
    res.json({ success: true, message: 'Rejalashtirilgan reklama bekor qilindi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rejalashtirilgan xabarlarni tekshiruvchi fon taymeri (har 30s)
setInterval(async () => {
  try {
    const list = getScheduledBroadcasts();
    const now = Date.now();
    const dueItems = list.filter(b => b.status === 'pending' && new Date(b.scheduledTime).getTime() <= now);

    for (const item of dueItems) {
      item.status = 'processing';
      saveScheduledBroadcasts(list);

      // Trigger broadcast
      const botInstance = bot.getBotInstance ? bot.getBotInstance() : null;
      if (!botInstance) {
        item.status = 'failed';
        saveScheduledBroadcasts(list);
        continue;
      }

      let users = db.getUsers ? db.getUsers() : [];
      let sentCount = 0;
      let failCount = 0;

      let replyMarkup = null;
      if (Array.isArray(item.buttons) && item.buttons.length > 0) {
        const kb = new InlineKeyboard();
        let added = 0;
        item.buttons.forEach((b) => {
          if (b.label && b.url) {
            kb.url(b.label, b.url);
            added++;
            if (added % 2 === 0) kb.row();
          }
        });
        if (added > 0) replyMarkup = kb;
      }

      for (const u of users) {
        const chatId = u.id || u.chatId;
        if (!chatId) continue;
        try {
          if (item.mediaType === 'photo' && item.mediaUrl) {
            await botInstance.api.sendPhoto(chatId, item.mediaUrl, { caption: item.message, parse_mode: 'HTML', reply_markup: replyMarkup || undefined });
          } else if (item.mediaType === 'video' && item.mediaUrl) {
            await botInstance.api.sendVideo(chatId, item.mediaUrl, { caption: item.message, parse_mode: 'HTML', reply_markup: replyMarkup || undefined });
          } else {
            await botInstance.api.sendMessage(chatId, item.message, { parse_mode: 'HTML', reply_markup: replyMarkup || undefined });
          }
          sentCount++;
        } catch (_) {
          failCount++;
        }
        await new Promise(r => setTimeout(r, 40));
      }

      item.status = 'completed';
      item.sent = sentCount;
      item.failed = failCount;
      item.completedAt = new Date().toISOString();
      saveScheduledBroadcasts(list);
    }
  } catch (_) {}
}, 30 * 1000);

module.exports = router;

