const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const db = require('./db');

let botInstance = null;
let isBotRunning = false;

function getCleanSponsorChannel() {
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

  // Validate username regex pattern
  const isValidUsername = cleanUsername && /^@[a-zA-Z0-9_]+$/.test(cleanUsername);
  if (!isValidUsername && process.env.MOVIE_SPONSOR_CHANNEL_LINK) {
    const link = process.env.MOVIE_SPONSOR_CHANNEL_LINK.trim();
    if (link.includes('t.me/')) {
      const parts = link.split('t.me/');
      cleanUsername = '@' + parts[parts.length - 1].split('/')[0].split('?')[0];
    }
  }

  if (cleanUsername && /^@[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return cleanUsername;
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

        const cleanUsername = getCleanSponsorChannel();
        if (cleanUsername) {
          try {
            const chatMember = await ctx.api.getChatMember(cleanUsername, ctx.from.id);
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
            if (!isMember) {
              const channelLink = process.env.MOVIE_SPONSOR_CHANNEL_LINK || `https://t.me/${cleanUsername.replace('@', '')}`;
              const keyboard = new InlineKeyboard()
                .url('📢 Kanalga A\'zo Bo\'lish', channelLink)
                .row()
                .text('🔄 A\'zolikni Tekshirish', 'chk_sub');

              return await ctx.reply(
                `⚠️ **Botdan foydalanish uchun rasmiy kanalimizga a'zo bo'ling!**\n\nKanalga a'zo bo'lgach, botdan to'liq foydalanishingiz mumkin.`,
                { parse_mode: 'Markdown', reply_markup: keyboard }
              );
            }
          } catch (err) {
            console.error('Movie Bot sponsor check error:', err.message);
          }
        }

        await next();
      });

      // Keyboard
      const mainKeyboard = new Keyboard()
        .text('🔍 Kino Qidirish').text('ℹ️ Yordam')
        .resized();

      // Start Command
      botInstance.command('start', (ctx) => {
        let msg = `👋 **Salom, ${ctx.from.first_name || 'foydalanuvchi'}!**\n\n` +
          `Men **Kino Note (Film) Bot**man.\n\n` +
          `🍿 Menga istalgan kino kodini yuboring (masalan: \`101\`), men sizga kinoni yuboraman!\n` +
          `🔍 Kino qidirish uchun **Kino Qidirish** tugmasini bosing yoki shunchaki kino nomini yozing.`;

        if (isAdmin(ctx.from.id)) {
          msg += `\n\n⚙️ **Admin buyruqlari:**\n` +
            `• Videoni yuboring, so'ngra javob tariqasida (reply) \`/add [kod] [nomi] | [tavsifi]\` deb yozib kinoni bazaga qo'shing.`;
        }

        ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: mainKeyboard });
      });

      // Help Command
      botInstance.command('help', (ctx) => {
        ctx.reply(
          `❓ **Yordam bo'limi:**\n\n` +
          `• Kino kodini (masalan: 101) yuboring -> Kino yuklab beriladi.\n` +
          `• Kino nomini yozing -> Kino nomiga qarab qidiriladi.`,
          { reply_markup: mainKeyboard }
        );
      });

      botInstance.on('message:text', async (ctx) => {
        const text = ctx.message.text.trim();

        if (text === '🔍 Kino Qidirish') {
          return await ctx.reply('🔍 Kino nomini kiriting:');
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
            return await ctx.reply('⚠️ Format noto\'g\'ri. To\'g\'ri format: `/add [kod] [kino nomi] | [tavsifi]`', { parse_mode: 'Markdown' });
          }

          const code = params.substring(0, splitIdx).trim();
          let movieInfo = params.substring(splitIdx).trim();
          let title = movieInfo;
          let description = '';

          if (movieInfo.includes('|')) {
            const parts = movieInfo.split('|');
            title = parts[0].trim();
            description = parts[1].trim();
          }

          const result = db.addMovie({ code, title, description, fileId });
          if (result) {
            return await ctx.reply(`✅ **Kino muvaffaqiyatli saqlandi!**\n\n🔑 Kod: \`${result.code}\`\n🎬 Nomi: *${result.title}*\n📝 Tavsif: _${result.description}_`, { parse_mode: 'Markdown' });
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
            const captionText = `🎬 **${movie.title}**\n\n🔑 Kod: \`${movie.code}\`\n\n📝 _${movie.description || 'Tavsif berilmagan'}_`;
            
            try {
              return await ctx.replyWithVideo(movie.fileId, {
                caption: captionText,
                parse_mode: 'Markdown'
              });
            } catch (err) {
              try {
                // If it fails (maybe it's a document/file), send as document
                return await ctx.replyWithDocument(movie.fileId, {
                  caption: captionText,
                  parse_mode: 'Markdown'
                });
              } catch (e) {
                console.error('Failed to send movie:', e.message);
                return await ctx.reply(`❌ Kinoni yuborishda muammo yuz berdi. Iltimos, admin bilan bog'laning.`);
              }
            }
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
          return await ctx.reply(`🔍 **Kino topilmadi.**\n\nKod: \`${text}\` ga mos film topilmadi. Nomi bo'yicha qidirib ko'ring.`, { parse_mode: 'Markdown' });
        } else {
          return await ctx.reply(`❌ Kechirasiz, **"${text}"** nomli film topilmadi. Boshqa nom yozib ko'ring.`, { parse_mode: 'Markdown' });
        }
      });

      // Handle video files directly from admin (providing instructions)
      botInstance.on(['message:video', 'message:document'], async (ctx) => {
        if (isAdmin(ctx.from.id)) {
          await ctx.reply(
            `📥 **Video fayl qabul qilindi.**\n\n` +
            `Ushbu faylni kino sifatida saqlash uchun, unga **javob (reply)** tariqasida quyidagi formatda yozing:\n\n` +
            `/add \`[kod]\` \`[nomi]\` | \`[tavsifi]\` \n\n` +
            `Masalan:\n` +
            `/add \`101\` \`Forsaj 9\` | \`Dominik Toretto sarguzashtlari\` `,
            { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id }
          );
        }
      });

      // Handle inline button selection for movie search
      botInstance.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        await ctx.answerCallbackQuery().catch(() => {});

        // Sponsor Check
        if (data === 'chk_sub') {
          const cleanUsername = getCleanSponsorChannel();
          if (!cleanUsername) {
            await ctx.reply('✅ Rahmat! A\'zolik muvaffaqiyatli tekshirildi. Boshlash uchun kino kodini kiriting.');
            try { await ctx.deleteMessage(); } catch (e) {}
            return;
          }

          try {
            const chatMember = await ctx.api.getChatMember(cleanUsername, ctx.from.id);
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
            if (isMember) {
              await ctx.reply('✅ Rahmat! A\'zoligingiz tasdiqlandi. Kino kodini yuboring.');
              try { await ctx.deleteMessage(); } catch (e) {}
            } else {
              await ctx.answerCallbackQuery({
                text: '❌ Siz hali kanalga a\'zo bo\'lmadingiz.',
                show_alert: true
              });
            }
          } catch (err) {
            console.error('Sponsor check callback error:', err.message);
            await ctx.reply('✅ A\'zolik muvaffaqiyatli tekshirildi. Kino kodini yuboring.');
            try { await ctx.deleteMessage(); } catch (e) {}
          }
          return;
        }

        if (data.startsWith('mv:')) {
          const code = data.split(':')[1];
          const movie = db.getMovieByCode(code);
          if (movie) {
            db.trackMovieView(code);
            const captionText = `🎬 **${movie.title}**\n\n🔑 Kod: \`${movie.code}\`\n\n📝 _${movie.description || 'Tavsif berilmagan'}_`;
            try {
              await ctx.replyWithVideo(movie.fileId, {
                caption: captionText,
                parse_mode: 'Markdown'
              });
            } catch (err) {
              try {
                await ctx.replyWithDocument(movie.fileId, {
                  caption: captionText,
                  parse_mode: 'Markdown'
                });
              } catch (e) {
                await ctx.reply('❌ Kinoni yuborib bo\'lmadi.');
              }
            }
          }
        }
      });

      botInstance.start({
        onStart: (botInfo) => {
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

module.exports = {
  startBot,
  stopBot,
  getBotStatus,
  getBotInstance
};
