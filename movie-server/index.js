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

const tunnelManager = require('./tunnelManager');

// Serve Static Frontend files of movie-client (if compiled)
const clientDist = path.join(__dirname, '..', 'movie-client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Kino Bot Backend is running. Please compile the movie client, or connect your movie bot!');
  });
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

  // Automatically start Telegram Bot on boot if token is present
  const botToken = process.env.MOVIE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    console.log('MOVIE_BOT_TOKEN found. Booting Movie Telegram bot...');
    bot.startBot(botToken)
      .then(() => console.log('Movie Telegram Bot initialization check completed.'))
      .catch((err) => console.error('Movie Telegram Bot auto-start failed:', err.message));
  } else {
    console.log('No MOVIE_BOT_TOKEN configured. Movie Bot is inactive. Set the token in config to start it.');
  }
});
