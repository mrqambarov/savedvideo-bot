const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const apiRouter = require('./api');
const bot = require('./bot');
const { ensureBinaries } = require('./setup');
const { cleanTempDirectory } = require('./processor');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Unregister any cached service workers across the domain
app.get('/sw.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send('self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", (e) => { e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then(clients => clients.forEach(c => c.navigate(c.url)))); });');
});

// Serve Admin Panel (admin-panel/dist) on /panel and Client (client/dist) on /
const adminDist = path.join(__dirname, '..', 'admin-panel', 'dist');
const clientDist = path.join(__dirname, '..', 'client', 'dist');

if (fs.existsSync(adminDist)) {
  app.use('/panel', express.static(adminDist));
  app.get('/panel', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
  app.get('/panel/*', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
}

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/panel') || req.path.startsWith('/movies') || req.path.startsWith('/movie') || req.path.startsWith('/adult')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else if (fs.existsSync(adminDist)) {
  app.use(express.static(adminDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/panel')) return next();
    res.sendFile(path.join(adminDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('SavedVideo Backend is running.');
  });
}

const { execFile } = require('child_process');

// Auto-Update yt-dlp binary
function autoUpdateYtDlp() {
  const isWindows = process.platform === 'win32';
  const binDir = path.join(__dirname, 'bin');
  const localYtDlp = path.join(binDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  const binToRun = fs.existsSync(localYtDlp) ? localYtDlp : 'yt-dlp';

  console.log('[Auto-Update] Checking yt-dlp latest updates...');
  execFile(binToRun, ['-U'], (err, stdout, stderr) => {
    if (stdout) console.log('[Auto-Update] yt-dlp:', stdout.trim());
    if (err) console.error('[Auto-Update] yt-dlp check warning:', err.message);
  });
}

// Auto-Backup Database to Admin Telegram Chat
async function sendDailyBackup() {
  try {
    const adminId = process.env.ADMIN_ID;
    const botInst = bot.getBotInstance();
    if (!adminId || !botInst) return;

    const dataDir = path.join(__dirname, 'data');
    const usersFile = path.join(dataDir, 'users.json');
    const statsFile = path.join(dataDir, 'stats.json');

    const dateStr = new Date().toISOString().split('T')[0];
    const caption = `💾 **Kunlik Avto-Backup:** (${dateStr})\n📊 Baza ma'lumotlari zaxira nusxasi`;

    const { InputFile } = require('grammy');
    if (fs.existsSync(usersFile)) {
      await botInst.api.sendDocument(adminId, new InputFile(usersFile, `users_${dateStr}.json`), { caption });
    }
    if (fs.existsSync(statsFile)) {
      await botInst.api.sendDocument(adminId, new InputFile(statsFile, `stats_${dateStr}.json`));
    }
    console.log('[Auto-Backup] Daily backup sent to admin Telegram successfully.');
  } catch (err) {
    console.error('[Auto-Backup] Error sending daily backup:', err.message);
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Express API Server running on port ${PORT}`);

  // Initial temp cleanup and set periodic interval (every 30 minutes)
  cleanTempDirectory();
  setInterval(() => {
    cleanTempDirectory();
  }, 30 * 60 * 1000);

  // Ensure yt-dlp, ffmpeg, ffprobe binaries are correctly downloaded and copied
  try {
    console.log('Verifying server binaries...');
    await ensureBinaries();
    console.log('Server binaries verification complete.');
  } catch (err) {
    console.error('CRITICAL: Server binaries setup failed:', err.message);
  }



  // Run initial auto-update yt-dlp and schedule every 24 hours
  autoUpdateYtDlp();
  setInterval(() => {
    autoUpdateYtDlp();
    sendDailyBackup();
  }, 24 * 60 * 60 * 1000);

  // Automatically start Telegram Bot on boot (only if distinct token from Movie Bot)
  const downloaderToken = process.env.DOWNLOADER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const movieToken = process.env.MOVIE_BOT_TOKEN;

  if (downloaderToken && downloaderToken !== movieToken) {
    console.log('TELEGRAM_BOT_TOKEN found. Booting Downloader Telegram bot...');
    bot.startBot(downloaderToken)
      .then(() => {
        console.log('Telegram Bot initialization check completed.');
        setTimeout(sendDailyBackup, 10000);
      })
      .catch((err) => console.error('Telegram Bot auto-start failed:', err.message));
  } else if (downloaderToken && downloaderToken === movieToken) {
    console.warn('WARNING: DOWNLOADER_BOT_TOKEN is identical to MOVIE_BOT_TOKEN! Downloader Bot startup skipped to prevent 409 Conflict with Movie Bot.');
  } else {
    console.log('No TELEGRAM_BOT_TOKEN configured. Downloader Bot is inactive.');
  }
}).on('error', (err) => {
  console.warn('Express API Server listen notice:', err.message);
});

