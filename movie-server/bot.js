const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const db = require('./db');
const fs = require('fs');
const path = require('path');

let botInstance = null;
let isBotRunning = false;
let botUsername = '';
const genres = ['Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Tarjima kino', 'Sarguzasht'];
const userSession = new Map(); // userId -> state
const userPendingActions = new Map(); // userId -> pending message context

// getChatMember fails on every message when the bot is not an admin of the
// sponsor channel ("member list is inaccessible"). Throttle that log to once
// per 5 minutes and spell out the fix, instead of flooding the error log.
let _lastSponsorWarn = 0;
function warnSponsorCheck(channel, err) {
  const now = Date.now();
  if (now - _lastSponsorWarn < 5 * 60 * 1000) return;
  _lastSponsorWarn = now;
  console.error(`Sponsor check failed for ${channel}: ${err.message}. Botni "${channel}" kanaliga ADMIN qiling — getChatMember shuni talab qiladi.`);
}

function getActiveSponsorChannel() {
  try {
    const channelsPath = path.join(__dirname, '..', 'channels.json');
    if (fs.existsSync(channelsPath)) {
      const channels = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
      if (channels && channels.length > 0) {
        const epochDays = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
        const activeIndex = Math.floor(epochDays / 2) % channels.length;
        const channel = channels[activeIndex];

        let cleanUsername = channel.username.trim().replace(/\s+/g, '');
        if (cleanUsername.includes('t.me/')) {
          const parts = cleanUsername.split('t.me/');
          cleanUsername = '@' + parts[parts.length - 1].split('/')[0];
        } else if (!cleanUsername.startsWith('@')) {
          cleanUsername = '@' + cleanUsername;
        }

        if (/^@[a-zA-Z0-9_]+$/.test(cleanUsername)) {
          return {
            username: cleanUsername,
            link: channel.link || `https://t.me/${cleanUsername.replace('@', '')}`
          };
        }
      }
    }
  } catch (e) {
    console.error('Movie bot: error reading active sponsor channel:', e.message);
  }

  // Fallback to .env
  const sponsorEnabled = process.env.MOVIE_SPONSOR_CHANNEL_ENABLED === 'true';
  if (!sponsorEnabled) return null;

  let channelUsername = process.env.MOVIE_SPONSOR_CHANNEL_USERNAME;
  let cleanUsername = null;
  if (channelUsername) {
    cleanUsername = channelUsername.trim().replace(/\s+/g, '');
    if (cleanUsername.includes('t.me/')) {
      const parts = cleanUsername.split('t.me/');
      cleanUsername = '@' + parts[parts.length - 1].split('/')[0];
    } else if (!cleanUsername.startsWith('@')) {
      cleanUsername = '@' + cleanUsername;
    }
  }

  const isValidUsername = cleanUsername && /^@[a-zA-Z0-9_]+$/.test(cleanUsername);
  if (!isValidUsername && process.env.MOVIE_SPONSOR_CHANNEL_LINK) {
    const link = process.env.MOVIE_SPONSOR_CHANNEL_LINK.trim();
    if (link.includes('t.me/')) {
      const parts = link.split('t.me/');
      cleanUsername = '@' + parts[parts.length - 1].split('/')[0].split('?')[0];
    }
  }

  if (cleanUsername && /^@[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return {
      username: cleanUsername,
      link: process.env.MOVIE_SPONSOR_CHANNEL_LINK || `https://t.me/${cleanUsername.replace('@', '')}`
    };
  }
  return null;
}

function isAdmin(userId) {
  const adminIdsStr = process.env.MOVIE_ADMIN_IDS || '';
  const adminIds = adminIdsStr.split(',').map(id => Number(id.trim()));
  return adminIds.includes(Number(userId));
}

function startBot(token) {
  return new Promise((resolve, reject) => {
    if (isBotRunning) {
      return resolve(true);
    }

    try {
      botInstance = new Bot(token);

      botInstance.catch((err) => {
        console.error('Movie Bot Error:', err.message);
      });

      // User Tracking and Sponsor Verification Middleware
      botInstance.use(async (ctx, next) => {
        if (ctx.from && !ctx.from.is_bot) {
          db.addUser(ctx.from);
          db.trackActiveUser(ctx.from.id);
        }

        // Bypass checks for callback queries checking subscription, start/help commands, or if user is admin
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'chk_sub') {
          return await next();
        }
        if (ctx.message && ctx.message.text && (ctx.message.text.startsWith('/start') || ctx.message.text.startsWith('/help') || isAdmin(ctx.from.id))) {
          return await next();
        }

        const activeChannel = getActiveSponsorChannel();
        if (activeChannel) {
          try {
            const chatMember = await ctx.api.getChatMember(activeChannel.username, ctx.from.id);
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
            if (!isMember) {
              // Save pending message so we can process after verification
              if (ctx.message) {
                userPendingActions.set(ctx.from.id, { message: ctx.message });
              }

              const keyboard = new InlineKeyboard()
                .url(`📢 ${activeChannel.username} kanaliga a'zo bo'lish`, activeChannel.link)
                .row()
                .text('🔄 A\'zolikni Tekshirish', 'chk_sub');

              return await ctx.reply(
                `⚠️ **Botdan foydalanish uchun kanalimizga a'zo bo'ling!**\n\n📢 ${activeChannel.username}\n\nA'zo bo'lgach, "A'zolikni Tekshirish" tugmasini bosing — bot so'rovingizni darhol bajaradi.`,
                { parse_mode: 'Markdown', reply_markup: keyboard }
              );
            }
          } catch (err) {
            warnSponsorCheck(activeChannel.username, err);
          }
        }

        await next();
      });

      // Keyboard
      const mainKeyboard = new Keyboard()
        .text('🔍 Kino Qidirish').text('🗂 Janrlar')
        .row()
        .text('🙋‍♂️ Buyurtma berish').text('ℹ️ Yordam')
        .resized();

      // Start Command
      botInstance.command('start', async (ctx) => {
        const match = ctx.match;
        if (match) {
          const movie = db.getMovieByCode(match);
          if (movie) {
            db.trackMovieView(match);
            return await sendMovie(ctx, movie);
          }
        }

        let msg = `👋 **Salom, ${ctx.from.first_name || 'foydalanuvchi'}!**\n\n` +
          `Men **Kino Note (Film) Bot**man.\n\n` +
          `🍿 Menga istalgan kino kodini yuboring (masalan: \`101\`), men sizga kinoni yuboraman!\n` +
          `🔍 Kino qidirish uchun **Kino Qidirish** tugmasini bosing yoki shunchaki kino nomini yozing.\n\n` +
          `🆔 Sizning Telegram IDingiz: \`${ctx.from.id}\``;

        if (isAdmin(ctx.from.id)) {
          msg += `\n\n⚙️ **Admin buyruqlari:**\n` +
            `• Videoni yuboring, so'ngra javob tariqasida (reply) \`/add [kod] [nomi] | [tavsifi] | [janri]\` deb yozib kinoni bazaga qo'shing.`;
        }

        ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: mainKeyboard });
      });

      // Help Command
      botInstance.command('help', (ctx) => {
        ctx.reply(
          `❓ **Yordam bo'limi:**\n\n` +
          `• Kino kodini (masalan: 101) yuboring -> Kino yuklab beriladi.\n` +
          `• Kino nomini yozing -> Kino nomiga qarab qidiriladi.\n` +
          `• Janrlar bo'yicha qidirish uchun **🗂 Janrlar** tugmasini bosing.`,
          { reply_markup: mainKeyboard }
        );
      });

      botInstance.on('message:text', async (ctx) => {
        const text = ctx.message.text.trim();
        const userId = ctx.from.id;

        // Check if user is in a state
        const state = userSession.get(userId);
        if (state === 'waiting_for_request_title') {
          userSession.delete(userId);
          const title = text.trim();
          if (title.length < 2) {
            return await ctx.reply('⚠️ Kino nomi juda qisqa. Qaytadan urinib ko\'ring.');
          }
          const request = db.addRequest(userId, ctx.from.username, title);
          if (request) {
            return await ctx.reply(
              `✅ **Buyurtmangiz muvaffaqiyatli qabul qilindi!**\n\n` +
              `🎬 Kino nomi: *${title}*\n\n` +
              `Operatorlarimiz uni tez orada bazaga qo'shishadi.`,
              { parse_mode: 'Markdown' }
            );
          } else {
            return await ctx.reply('❌ Buyurtmani saqlashda xatolik yuz berdi. Keyinroq urinib ko\'ring.');
          }
        }

        if (text === '🔍 Kino Qidirish') {
          return await ctx.reply('🔍 Kino nomini kiriting:');
        }

        if (text === '🗂 Janrlar') {
          const keyboard = new InlineKeyboard();
          genres.forEach((genre, idx) => {
            keyboard.text(genre, `genre:${genre}`);
            if (idx % 2 === 1) keyboard.row();
          });
          return await ctx.reply('🗂 **Janrlardan birini tanlang:**', {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }

        if (text === '🙋‍♂️ Buyurtma berish') {
          userSession.set(userId, 'waiting_for_request_title');
          return await ctx.reply('📝 **Iltimos, buyurtma qilmoqchi bo\'lgan kino nomini yozib yuboring:**\n\n(Masalan: `Forsaj 10` yoki `Avatar 2 Uzbek tilida`)');
        }

        if (text === 'ℹ️ Yordam') {
          return await ctx.reply(
            `❓ **Yordam bo'limi:**\n\n` +
            `• Kino kodini (masalan: 101) yuboring -> Kino yuklab beriladi.\n` +
            `• Kino nomini yozing -> Kino nomiga qarab qidiriladi.`,
            { reply_markup: mainKeyboard }
          );
        }

        // Check if admin is adding a movie
        if (text.startsWith('/add ') && isAdmin(ctx.from.id)) {
          const replyMsg = ctx.message.reply_to_message;
          let video = null;

          if (replyMsg) {
            video = replyMsg.video || replyMsg.document;
          } else if (ctx.message.video || ctx.message.document) {
            video = ctx.message.video || ctx.message.document;
          }

          if (!video) {
            return await ctx.reply('⚠️ Xatolik: Ushbu buyruqni videoli xabarga javob (reply) qilib yozishingiz kerak yoki video bilan birga yuborishingiz kerak.');
          }

          const fileId = video.file_id;
          const params = text.substring(5).trim(); // Remove "/add "
          const splitIdx = params.indexOf(' ');
          
          if (splitIdx === -1) {
            return await ctx.reply('⚠️ Format noto\'g\'ri. To\'g\'ri format: `/add [kod] [kino nomi] | [tavsifi] | [janri]`', { parse_mode: 'Markdown' });
          }

          const code = params.substring(0, splitIdx).trim();
          let movieInfo = params.substring(splitIdx).trim();
          let title = movieInfo;
          let description = '';
          let genre = 'Tarjima kino';

          if (movieInfo.includes('|')) {
            const parts = movieInfo.split('|');
            title = parts[0].trim();
            description = parts[1].trim();
            if (parts[2]) {
              genre = parts[2].trim();
            }
          }

          const result = db.addMovie({ code, title, description, fileId, genre });
          if (result) {
            return await ctx.reply(`✅ **Kino muvaffaqiyatli saqlandi!**\n\n🔑 Kod: \`${result.code}\`\n🎬 Nomi: *${result.title}*\n📝 Janr: _${result.genre}_\n📝 Tavsif: _${result.description}_`, { parse_mode: 'Markdown' });
          } else {
            return await ctx.reply('❌ Bazaga saqlashda xatolik yuz berdi.');
          }
        }

        // Check if input is a movie code (number)
        const isCode = /^[a-zA-Z0-9_-]+$/.test(text);
        if (isCode) {
          const movie = db.getMovieByCode(text);
          if (movie) {
            db.trackMovieView(text);
            return await sendMovie(ctx, movie);
          }
        }

        // Default: Search movie by name
        db.trackSearch();
        const results = db.searchMovies(text);
        if (results && results.length > 0) {
          let replyText = `🔍 **"${text}" bo'yicha topilgan kinolar:**\n\n`;
          const keyboard = new InlineKeyboard();

          results.slice(0, 10).forEach((m, idx) => {
            replyText += `${idx + 1}. *${m.title}* - Kod: \`${m.code}\`\n`;
            keyboard.text(`${idx + 1} 🎬`, `mv:${m.code}`);
          });

          return await ctx.reply(replyText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }

        // If no movie found with that code or name
        if (isCode) {
          const keyboard = new InlineKeyboard().text('🙋‍♂️ Ushbu kinoni buyurtma qilish', 'req_movie');
          return await ctx.reply(`🔍 **Kino topilmadi.**\n\nKod: \`${text}\` ga mos film topilmadi. Nomi bo'yicha qidirib ko'ring.`, { parse_mode: 'Markdown', reply_markup: keyboard });
        } else {
          const keyboard = new InlineKeyboard().text('🙋‍♂️ Ushbu kinoni buyurtma qilish', `req_title:${text}`);
          return await ctx.reply(`❌ Kechirasiz, **"${text}"** nomli film topilmadi. Boshqa nom yozib ko'ring.`, { parse_mode: 'Markdown', reply_markup: keyboard });
        }
      });

      // Handle video files directly from admin (providing instructions)
      botInstance.on(['message:video', 'message:document'], async (ctx) => {
        if (isAdmin(ctx.from.id)) {
          await ctx.reply(
            `📥 **Video fayl qabul qilindi.**\n\n` +
            `Ushbu faylni kino sifatida saqlash uchun, unga **javob (reply)** tariqasida quyidagi formatda yozing:\n\n` +
            `/add \`[kod]\` \`[nomi]\` | \`[tavsifi]\` | \`[janri]\` \n\n` +
            `Masalan:\n` +
            `/add \`101\` \`Forsaj 9\` | \`Dominik Toretto sarguzashtlari\` | \`Jangari\` `,
            { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
          );
        }
      });

      // Handle inline button selection for movie search
      botInstance.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;

        // Sponsor Check
        if (data === 'chk_sub') {
          await ctx.answerCallbackQuery().catch(() => {});
          const activeChannel = getActiveSponsorChannel();
          if (!activeChannel) {
            try { await ctx.deleteMessage(); } catch (e) {}
            const pending = userPendingActions.get(ctx.from.id);
            if (pending) {
              userPendingActions.delete(ctx.from.id);
              ctx.message = pending.message;
              return await next();
            }
            return;
          }

          try {
            const chatMember = await ctx.api.getChatMember(activeChannel.username, ctx.from.id);
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
            if (isMember) {
              try { await ctx.deleteMessage(); } catch (e) {}
              const pending = userPendingActions.get(ctx.from.id);
              if (pending) {
                userPendingActions.delete(ctx.from.id);
                ctx.message = pending.message;
                return await next();
              } else {
                await ctx.reply('✅ A\'zoligingiz tasdiqlandi! Kino kodi yoki nomini yuboring.');
              }
            } else {
              await ctx.answerCallbackQuery({
                text: '❌ Siz hali kanalga a\'zo bo\'lmadingiz.',
                show_alert: true
              });
            }
          } catch (err) {
            console.error('Sponsor check callback error:', err.message);
            try { await ctx.deleteMessage(); } catch (e) {}
            const pending = userPendingActions.get(ctx.from.id);
            if (pending) {
              userPendingActions.delete(ctx.from.id);
              ctx.message = pending.message;
              return await next();
            }
          }
          return;
        }

        // Like / Dislike Callback
        if (data.startsWith('like:') || data.startsWith('dislike:')) {
          const parts = data.split(':');
          const voteType = parts[0];
          const code = parts[1];

          const result = db.toggleLikeDislike(code, ctx.from.id, voteType);
          if (result) {
            const keyboard = new InlineKeyboard()
              .text(`👍 ${result.likesCount}`, `like:${code}`)
              .text(`👎 ${result.dislikesCount}`, `dislike:${code}`);
            try {
              await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
            } catch (e) {}
          }
          await ctx.answerCallbackQuery({ text: "Rahmat! Bahongiz qabul qilindi." }).catch(() => {});
          return;
        }

        // Genre Click Callback
        if (data.startsWith('genre:')) {
          const selectedGenre = data.split(':')[1];
          const movies = db.getMovies().filter(m => String(m.genre).trim() === selectedGenre.trim());
          
          if (movies.length === 0) {
            await ctx.reply(`🔍 **"${selectedGenre}"** janrida hozircha kinolar yo'q.`, { parse_mode: 'Markdown' });
          } else {
            let replyText = `🔍 **"${selectedGenre}" janridagi kinolar:**\n\n`;
            const keyboard = new InlineKeyboard();
            movies.slice(0, 10).forEach((m, idx) => {
              replyText += `${idx + 1}. *${m.title}* - Kod: \`${m.code}\`\n`;
              keyboard.text(`${idx + 1} 🎬`, `mv:${m.code}`);
            });
            await ctx.reply(replyText, {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          }
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        // Request Movie Button Click Callback
        if (data === 'req_movie') {
          userSession.set(ctx.from.id, 'waiting_for_request_title');
          await ctx.reply('📝 **Iltimos, buyurtma qilmoqchi bo\'lgan kino nomini yozib yuboring:**');
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data.startsWith('req_title:')) {
          const title = data.split(':')[1];
          const request = db.addRequest(ctx.from.id, ctx.from.username, title);
          if (request) {
            await ctx.reply(
              `✅ **Buyurtmangiz muvaffaqiyatli qabul qilindi!**\n\n` +
              `🎬 Kino nomi: *${title}*\n\n` +
              `Operatorlarimiz uni tez orada bazaga qo'shishadi.`,
              { parse_mode: 'Markdown' }
            );
          } else {
            await ctx.reply('❌ Buyurtmani saqlashda xatolik yuz berdi.');
          }
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        if (data.startsWith('mv:')) {
          const code = data.split(':')[1];
          const movie = db.getMovieByCode(code);
          if (movie) {
            db.trackMovieView(code);
            await sendMovie(ctx, movie);
          }
          await ctx.answerCallbackQuery().catch(() => {});
        }
      });

      botInstance.start({
        onStart: (botInfo) => {
          botUsername = botInfo.username;
          console.log(`Movie Telegram Bot @${botInfo.username} started successfully.`);
        }
      }).catch((err) => {
        console.error('Movie Bot polling error:', err.message);
        isBotRunning = false;
      });

      isBotRunning = true;
      resolve(true);
    } catch (err) {
      isBotRunning = false;
      botInstance = null;
      console.error('Failed to start Movie Bot:', err.message);
      reject(err);
    }
  });
}

async function sendMovie(ctx, movie) {
  const likesCount = movie.likes ? movie.likes.length : 0;
  const dislikesCount = movie.dislikes ? movie.dislikes.length : 0;
  const downloaderBotUsername = process.env.DOWNLOADER_BOT_USERNAME || 'savemedia_music_bot';
  const captionText = `🎬 **${movie.title}**\n\n` +
    `🗂 Janr: #${movie.genre ? movie.genre.replace(/\s+/g, '_') : 'Tarjima_kino'}\n` +
    `🔑 Kod: \`${movie.code}\`\n\n` +
    `📝 _${movie.description || 'Tavsif berilmagan'}_\n\n` +
    `📹 YouTube, Instagram, TikTokdan yuklab olish: @${downloaderBotUsername}`;

  const keyboard = new InlineKeyboard()
    .text(`👍 ${likesCount}`, `like:${movie.code}`)
    .text(`👎 ${dislikesCount}`, `dislike:${movie.code}`);

  try {
    return await ctx.replyWithVideo(movie.fileId, {
      caption: captionText,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (err) {
    try {
      return await ctx.replyWithDocument(movie.fileId, {
        caption: captionText,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (e) {
      console.error('Failed to send movie:', e.message);
      return await ctx.reply(`❌ Kinoni yuborishda muammo yuz berdi. Iltimos, admin bilan bog'laning.`);
    }
  }
}

async function stopBot() {
  if (!isBotRunning || !botInstance) {
    return true;
  }
  try {
    await botInstance.stop();
    isBotRunning = false;
    botInstance = null;
    console.log('Movie Telegram Bot stopped successfully.');
    return true;
  } catch (err) {
    console.error('Error stopping movie bot:', err.message);
    return false;
  }
}

function getBotStatus() {
  return {
    running: isBotRunning,
    hasToken: !!(process.env.MOVIE_BOT_TOKEN)
  };
}

function getBotInstance() {
  return botInstance;
}

function getBotUsername() {
  return botUsername;
}

module.exports = {
  startBot,
  stopBot,
  getBotStatus,
  getBotInstance,
  getBotUsername
};
