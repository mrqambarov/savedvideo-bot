const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiRouter = require('./api');
const bot = require('./bot');

const app = express();
const PORT = process.env.MOVIE_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);
app.use('/movies/api', apiRouter);
// NOTE: /adult/api is handled exclusively by adult-server (port 5002)

const tunnelManager = require('./tunnelManager');

// Serve Static Admin Panel (if compiled)
const adminDist = path.join(__dirname, '..', 'admin-panel', 'dist');
if (fs.existsSync(adminDist)) {
  app.use('/admin-panel', express.static(adminDist));
}

// Serve Static Frontend files of movie-client (if compiled)
const clientDist = path.join(__dirname, '..', 'movie-client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    // Don't serve SPA for API or adult routes
    if (req.path.startsWith('/api') || req.path.startsWith('/adult')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Kino Bot Backend is running. Please compile the movie client, or connect your movie bot!');
  });
}

// Automatically start Telegram Bot for Xit Film
const movieToken = process.env.MOVIE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
if (movieToken && movieToken.trim() !== '') {
  console.log('Booting Xit Film Telegram bot...');
  bot.startBot(movieToken)
    .then(() => console.log('Xit Film Telegram Bot started successfully.'))
    .catch((err) => console.error('Xit Film Telegram Bot start failed:', err.message));
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Movie API Server running on port ${PORT}`);

  // Auto-establish HTTPS tunnel for Telegram Mini App
  try {
    await tunnelManager.ensureHttpsTunnel(PORT);
  } catch (tunnelErr) {
    console.warn('Tunnel init warning:', tunnelErr.message);
  }
}).on('error', (err) => {
  console.warn('Movie API Server listen notice:', err.message);
});
