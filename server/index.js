const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const apiRouter = require('./api');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Serve Static Frontend files (if compiled)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('SavedVideo Backend is running. Please compile the client to access the web panel here, or connect your bot!');
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Express API Server running on port ${PORT}`);

  // Automatically start Telegram Bot on boot if token is present
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    console.log('TELEGRAM_BOT_TOKEN found. Booting Telegram bot...');
    bot.startBot(botToken)
      .then(() => console.log('Telegram Bot initialization check completed.'))
      .catch((err) => console.error('Telegram Bot auto-start failed:', err.message));
  } else {
    console.log('No TELEGRAM_BOT_TOKEN configured. Bot is inactive. Set the token in .env or the web UI to start it.');
  }
});
