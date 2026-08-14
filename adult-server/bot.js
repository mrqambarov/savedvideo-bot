const { Bot, InputFile, InlineKeyboard, Keyboard } = require('grammy');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const i18n = require('./i18n');

let botInstance = null;
let isBotRunning = false;
const userPendingActions = new Map();

// Sizning Telegram ID raqamingiz
const PRIMARY_ADMIN = 6263659922;

function isAdmin(userId) {
  const adminIdsStr = process.env.ADULT_ADMIN_IDS || '';
  const adminIds = adminIdsStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
  return adminIds.includes(Number(userId)) || Number(userId) === PRIMARY_ADMIN;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\ud800-\udfff]/g, '');
}

function getSingleBoshqaruvKeyboard() {
  return new Keyboard().text('⚡️ Boshqaruv').resized();
}

function getFullAdminKeyboard() {
  return new Keyboard()
    .text('📊 Statistika').text('👥 Foydalanuvchilar')
    .row()
    .text('🎬 Videolar').text('📫 Postlar')
    .row()
    .text('🔐 Kanallar').text('📩 So\'rovlar')
    .row()
    .text('◀️ Orqaga')
    .resized();
}

async function checkSponsorSubscription(ctx, userId) {
  try {
    const isEnabled = process.env.ADULT_SPONSOR_CHANNEL_ENABLED !== 'false';
    if (!isEnabled) return { ok: true };

    const channelUsername = process.env.ADULT_SPONSOR_CHANNEL_USERNAME || '@ehtiroslikodlar';
    const channelLink = process.env.ADULT_SPONSOR_CHANNEL_LINK || 'https://t.me/ehtiroslikodlar';

    if (!channelUsername) return { ok: true };

    const uname = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
    try {
      const member = await ctx.api.getChatMember(uname, userId);
      if (['left', 'kicked'].includes(member.status)) {
        return { ok: false, channel: { username: uname, link: channelLink, title: 'Kanalga A\'zo Bo\'ling' } };
      }
    } catch (err) {
      // If bot is not admin, don't block
    }
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

function safeLogActivity(payload) {
  try {
    const serverDb = require(path.resolve(__dirname, '../server/db'));
    if (serverDb && typeof serverDb.logActivity === 'function') {
      serverDb.logActivity(payload);
    }
  } catch (e) {}
}

async function sendMovie(ctx, movie) {
  const code = String(movie.code).trim();

  safeLogActivity({
    bot: '18+ Adult Bot',
    type: 'user',
    actor: ctx.from?.first_name || '👤 Foydalanuvchi',
    icon: '🔞',
    text: `18+ video ko'rildi (Kod: ${code})`,
    color: '#ef4444'
  });

  const cleanTitle = escapeHTML(movie.title || `Video #${code}`);
  const cleanDesc = escapeHTML(movie.description || '');

  const caption = `🔞 <b>${cleanTitle}</b>\n\n🔑 Kod: <code>${code}</code>\n\n📝 <i>${cleanDesc}</i>`;
  
  const likesCount = Array.isArray(movie.likes) ? movie.likes.length : (Number(movie.likes) || 0);
  const dislikesCount = Array.isArray(movie.dislikes) ? movie.dislikes.length : (Number(movie.dislikes) || 0);

  const keyboard = new InlineKeyboard()
    .text(`🔥 ${likesCount}`, `like:${code}`)
    .text(`❄️ ${dislikesCount}`, `dislike:${code}`);

  const plainCaption = `🔞 ${movie.title || ('Video #' + code)}\n\nKod: ${code}\n\n${movie.description || ''}`;

  try {
    if (movie.fileId) {
      await ctx.replyWithVideo(movie.fileId, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    } else if (movie.poster) {
      await ctx.replyWithPhoto(movie.poster, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (e) {
    try {
      await ctx.reply(plainCaption, { reply_markup: keyboard });
    } catch (err2) {
      console.error('Adult sendMovie error:', err2.message);
    }
  }
}

async function startBot(botToken) {
  if (isBotRunning && botInstance) return true;
  try {
    botInstance = new Bot(botToken);
    botInstance.catch((err) => console.error('Adult Grammy error:', err.message));

    // 1. Admin buyruqlari
    botInstance.hears('⚡️ Boshqaruv', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      await ctx.reply('⚡️ <b>Admin Boshqaruv Paneli:</b>', { parse_mode: 'HTML', reply_markup: getFullAdminKeyboard() });
    });

    botInstance.hears('📊 Statistika', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const stats = db.getAdvancedStats();
      await ctx.reply(`📊 <b>Bot Statistikasi:</b>\n\n👥 Foydalanuvchilar: <b>${stats.totalUsers} ta</b>\n🎬 18+ Videolar: <b>${stats.totalMovies} ta</b>\n👁 Ko'rishlar: <b>${stats.totalViews || 0} ta</b>\n📈 Bugungi yangi: <b>+${stats.growth?.newUsersToday || 0} ta</b>`, { parse_mode: 'HTML' });
    });

    botInstance.hears('👥 Foydalanuvchilar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const stats = db.getAdvancedStats();
      await ctx.reply(`👥 <b>Foydalanuvchilar:</b>\n\nJami: <b>${stats.totalUsers}</b>\nBugun: <b>+${stats.growth?.newUsersToday || 0}</b>\nBu hafta: <b>+${stats.growth?.newUsersWeek || 0}</b>`, { parse_mode: 'HTML' });
    });

    botInstance.hears('🎬 Videolar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const movies = db.getMovies() || [];
      let text = `🎬 <b>So'nggi 10 ta Video:</b>\n\n`;
      movies.slice(-10).reverse().forEach((m, i) => {
        text += `${i + 1}. <b>${escapeHTML(m.title)}</b> (Kod: <code>${m.code}</code>)\n`;
      });
      await ctx.reply(text || 'Videolar yo\'q', { parse_mode: 'HTML' });
    });

    botInstance.hears('📫 Postlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const channel = process.env.ADULT_AUTO_POST_CHANNEL || '@ehtiroslikodlar';
      await ctx.reply(`📫 <b>Avto-Post Kanali:</b> <code>${channel}</code>`, { parse_mode: 'HTML' });
    });

    botInstance.hears('🔐 Kanallar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const ch = process.env.ADULT_SPONSOR_CHANNEL_USERNAME || '@ehtiroslikodlar';
      await ctx.reply(`🔐 <b>Homiy Kanal:</b> ${ch}`, { parse_mode: 'HTML' });
    });

    botInstance.hears('📩 So\'rovlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const reqs = db.getRequests() || [];
      await ctx.reply(`📩 <b>So'rovlar:</b> ${reqs.length} ta`, { parse_mode: 'HTML' });
    });

    botInstance.hears('◀️ Orqaga', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      await ctx.reply('Bosh menyu', { reply_markup: getSingleBoshqaruvKeyboard() });
    });

    // 2. Start buyrug'i
    botInstance.command('start', async (ctx) => {
      const userId = ctx.from.id;
      const args = ctx.match ? String(ctx.match).trim() : '';

      if (args === 'login') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        db.saveAuthCode(userId, code);
        return await ctx.reply(`🔑 <b>Kirish kodingiz:</b> <code>${code}</code>`, { parse_mode: 'HTML' });
      }

      db.addUser(userId, ctx.from.username, ctx.from.first_name);
      const userLang = db.getUserLang(userId) || 'uz';

      if (args && args !== 'login') {
        const sub = await checkSponsorSubscription(ctx, userId);
        if (!sub.ok) {
          const kb = new InlineKeyboard()
            .url('➕ Kanalga a\'zo bo\'lish', sub.channel.link)
            .row()
            .text('✅ Obunani tekshirish', `chk_sub:${args}`);
          return await ctx.reply(`⚠️ <b>Videoni ko'rish uchun kanalimizga a'zo bo'ling:</b>`, { parse_mode: 'HTML', reply_markup: kb });
        }
        const movie = db.findMovieByCode(args);
        if (movie) return await sendMovie(ctx, movie);
      }

      await ctx.reply(i18n.t(userLang, 'welcome', { name: escapeHTML(ctx.from.first_name) }), {
        parse_mode: 'HTML',
        reply_markup: isAdmin(userId) ? getSingleBoshqaruvKeyboard() : { remove_keyboard: true }
      });
    });

    // 3. Likes & Dislikes Callbacks
    botInstance.callbackQuery(/^(like|dislike):(.+)$/, async (ctx) => {
      const action = ctx.match[1];
      const code = ctx.match[2];
      const movie = db.findMovieByCode(code);

      if (movie) {
        if (!Array.isArray(movie.likes)) movie.likes = [];
        if (!Array.isArray(movie.dislikes)) movie.dislikes = [];

        const uid = ctx.from.id;
        if (action === 'like') {
          if (!movie.likes.includes(uid)) movie.likes.push(uid);
          movie.dislikes = movie.dislikes.filter(id => id !== uid);
        } else {
          if (!movie.dislikes.includes(uid)) movie.dislikes.push(uid);
          movie.likes = movie.likes.filter(id => id !== uid);
        }

        const movies = db.getMovies();
        const idx = movies.findIndex(m => String(m.code).trim() === code);
        if (idx !== -1) {
          movies[idx] = movie;
          db.saveMovies(movies);
        }

        const newKb = new InlineKeyboard()
          .text(`🔥 ${movie.likes.length}`, `like:${code}`)
          .text(`❄️ ${movie.dislikes.length}`, `dislike:${code}`);

        try {
          await ctx.editMessageReplyMarkup({ reply_markup: newKb });
        } catch (e) {}
        await ctx.answerCallbackQuery({ text: action === 'like' ? '🔥 Like!' : '❄️ Dislike!' });
      } else {
        await ctx.answerCallbackQuery();
      }
    });

    // Sponsor check callback
    botInstance.callbackQuery(/^chk_sub:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      const sub = await checkSponsorSubscription(ctx, ctx.from.id);
      if (sub.ok) {
        await ctx.answerCallbackQuery({ text: 'Tasdiqlandi! ✅' });
        try { await ctx.deleteMessage(); } catch (e) {}
        const movie = db.findMovieByCode(code);
        if (movie) return await sendMovie(ctx, movie);
        await ctx.reply('✅ Obuna tasdiqlandi. Kodni yuboring:');
      } else {
        await ctx.answerCallbackQuery({ text: 'Kanalga a\'zo bo\'lmadingiz! ❌', show_alert: true });
      }
    });

    // 4. Video qo'shish jarayoni
    botInstance.on(['message:video', 'message:document'], async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const video = ctx.message.video || (ctx.message.document && ctx.message.document.mime_type?.startsWith('video/') ? ctx.message.document : null);
      if (!video) return;

      userPendingActions.set(ctx.from.id, { action: 'waiting_for_code', fileId: video.file_id, caption: ctx.message.caption || '' });
      await ctx.reply('📹 <b>Video qabul qilindi. Ushbu video uchun KOD yuboring:</b>', { parse_mode: 'HTML' });
    });

    botInstance.on('message:photo', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const pending = userPendingActions.get(ctx.from.id);
      if (pending && pending.action === 'waiting_for_poster') {
        userPendingActions.delete(ctx.from.id);
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        const result = db.addMovie({
          code: pending.code,
          title: `Video #${pending.code}`,
          description: pending.caption,
          fileId: pending.fileId,
          poster: photoId
        });

        if (result) {
          await ctx.reply('⚡️ <b>Video bazaga qo\'shildi. Kanalga post yuborilmoqda...</b>', { parse_mode: 'HTML' });
          await publishAutoPost(result);
          await ctx.reply('✅ <b>Kanalga muvaffaqiyatli joylandi!</b>', { parse_mode: 'HTML' });
        }
      }
    });

    // 5. Matnli xabarlar va Kodlar
    botInstance.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return;

      // Admin kod kiritayotgan bo'lsa
      const pending = userPendingActions.get(ctx.from.id);
      if (isAdmin(ctx.from.id) && pending && pending.action === 'waiting_for_code') {
        userPendingActions.set(ctx.from.id, { ...pending, action: 'waiting_for_poster', code: text });
        return await ctx.reply(`✅ Kod qabul qilindi: <b>${escapeHTML(text)}</b>\n\n🖼 <b>Endi video uchun POSTER (RASM) yuboring:</b>`, { parse_mode: 'HTML' });
      }

      // Sponsor check
      const sub = await checkSponsorSubscription(ctx, ctx.from.id);
      if (!sub.ok) {
        const kb = new InlineKeyboard()
          .url('➕ Kanalga a\'zo bo\'lish', sub.channel.link)
          .row()
          .text('✅ Obunani tekshirish', `chk_sub:${text}`);
        return await ctx.reply(`⚠️ <b>Videoni ko'rish uchun kanalimizga a'zo bo'ling:</b>`, { parse_mode: 'HTML', reply_markup: kb });
      }

      // Oddiy kod qidirish
      const movie = db.findMovieByCode(text);
      if (movie) return await sendMovie(ctx, movie);

      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      await ctx.reply(i18n.t(userLang, 'code_not_found', { code: escapeHTML(text) }), { parse_mode: 'HTML' });
    });

    isBotRunning = true;
    botInstance.start({ onStart: (info) => console.log(`Adult Bot @${info.username} qayta tiklandi.`) });
    return true;
  } catch (err) {
    console.error('Adult Bot startBot error:', err.message);
    isBotRunning = false;
    return false;
  }
}

async function publishAutoPost(movie) {
  if (!botInstance) return false;
  try {
    const channelId = process.env.ADULT_AUTO_POST_CHANNEL || '@ehtiroslikodlar';
    const botUsername = botInstance.botInfo?.username || 'Instavdeo_bot';
    const cleanTitle = escapeHTML(movie.title || `Video #${movie.code}`);
    const caption = `🔞 <b>YANGI 18+ PREMYERA!</b>\n\n🎬 <b>Nomi:</b> ${cleanTitle}\n🔑 <b>KODI:</b> <code>${movie.code}</code>`;
    const keyboard = new InlineKeyboard().url('📥 Botda ko\'rish', `https://t.me/${botUsername}?start=${movie.code}`);
    if (movie.poster) await botInstance.api.sendPhoto(channelId, movie.poster, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    else await botInstance.api.sendMessage(channelId, caption, { parse_mode: 'HTML', reply_markup: keyboard });
    return true;
  } catch (e) { return false; }
}

async function stopBot() { if (botInstance) await botInstance.stop(); isBotRunning = false; return true; }
module.exports = { startBot, stopBot, getBotStatus: () => ({ running: isBotRunning }), getBotInstance: () => botInstance };

