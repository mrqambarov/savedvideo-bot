const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bot = require('./bot');
const apiRouter = require('./api');
const { ensureHttpsTunnel } = require('./tunnelManager');

const app = express();
const PORT = process.env.ADULT_PORT || 5002;

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'adult-server', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`18+ Video API Server running on port ${PORT}`);

  // Ensure HTTPS Tunnel for Telegram Mini App
  ensureHttpsTunnel(PORT);

  // Boot 18+ Video Telegram Bot
  const botToken = process.env.ADULT_BOT_TOKEN;
  if (botToken) {
    console.log('ADULT_BOT_TOKEN found. Booting 18+ Video Telegram bot...');
    await bot.startBot(botToken);
  } else {
    console.warn('WARNING: No ADULT_BOT_TOKEN configured. Set ADULT_BOT_TOKEN in .env to activate it.');
  }
});
