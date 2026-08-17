const { Bot, InputFile, InlineKeyboard, Keyboard } = require('grammy');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const i18n = require('./i18n');

let botInstance = null;
let isBotRunning = false;
const userStates = new Map(); // userId -> { action: 'search' | 'request', timestamp }

function isAdmin(userId) {
  const adminIdsStr = process.env.MOVIE_ADMIN_IDS || process.env.ADMIN_ID || '6263659922';
  const adminIds = adminIdsStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
  return adminIds.includes(Number(userId)) || Number(userId) === 6263659922;
}

function getBotInstance() { return botInstance; }

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\ud800-\udfff]/g, '');
}

function getNextMovieCode() {
  try {
    const movies = db.getMovies() || [];
    const numericCodes = movies
      .map(m => parseInt(m.code, 10))
      .filter(n => !isNaN(n) && n > 0);
    if (numericCodes.length === 0) return '1001';
    const maxCode = Math.max(...numericCodes);
    return String(maxCode + 1);
  } catch (_) {
    return String(Math.floor(1000 + Math.random() * 9000));
  }
}

async function publishMoviePostToChannel(movie, shortsFileId = null, targetChannel = null) {
  const settings = db.getMovieSettings() || {};
  const channel = targetChannel || settings.autoPostChannel || process.env.AUTO_POST_CHANNEL || '@XitFilm_uz';
  const cleanChannel = channel.startsWith('@') ? channel : '@' + channel;
  const botUsername = botInstance?.botInfo?.username || process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
  const mCode = String(movie.code).trim();
  const miniAppUrl = `https://xitfilm.uz?code=${mCode}&tma=1&v=4.2.0`;

  const kb = new InlineKeyboard()
    .webApp('🎬 Ilovada Ko\'rish (4K HD)', miniAppUrl)
    .row()
    .url('🍿 Bot Orqali Yuklab Olish', `https://t.me/${botUsername}?start=${mCode}`);

  const desc = movie.description
    ? (movie.description.length > 250 ? movie.description.substring(0, 247) + '...' : movie.description)
    : 'Eng sara tarjima kinolar va shov-shuvli premyerani yuqori sifatda tomosha qiling!';

  const postCaption =
    `🔥 <b>YANGI PREMYERA: ${escapeHTML(movie.title.toUpperCase())}</b> 🔥\n\n` +
    `📁 <b>Janr:</b> #${escapeHTML((movie.genre || 'Kino').replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '_'))}\n` +
    `🔑 <b>Kino Kodi:</b> <code>${mCode}</code>\n\n` +
    `📝 <i>${escapeHTML(desc)}</i>\n\n` +
    `🍿 <b>Ko'rish yoki yuklab olish uchun pastdagi tugmalarni bosing:</b>\n` +
    `👉 <b>Bizning bot:</b> @${botUsername}`;

  if (shortsFileId) {
    await botInstance.api.sendVideo(cleanChannel, shortsFileId, {
      caption: postCaption,
      parse_mode: 'HTML',
      reply_markup: kb,
      supports_streaming: true
    });
  } else if (movie.poster && movie.poster.startsWith('http')) {
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
}

function getMainKeyboard(lang = 'uz') {
  return new Keyboard()
    .text(i18n.t(lang, 'search_btn')).text('⚡️ Shorts Lavhalar')
    .row()
    .text(i18n.t(lang, 'genre_btn')).text('👑 VIP Premium (⭐️)')
    .row()
    .text(i18n.t(lang, 'req_btn')).text(i18n.t(lang, 'lang_btn'))
    .resized();
}

async function checkSponsorSubscription(ctx, userId) {
  try {
    // VIP foydalanuvchilarga majburiy homiy kanal tekshirilmaydi
    if (db.isUserPremium && db.isUserPremium(userId)) return { ok: true };

    const settings = db.getMovieSettings() || {};
    if (settings.sponsorEnabled === false) return { ok: true };

    let channels = settings.sponsorChannels || [];
    if (!channels || channels.length === 0) {
      if (settings.sponsorUsername) {
        channels = [{ username: settings.sponsorUsername, link: settings.sponsorLink || `https://t.me/${settings.sponsorUsername.replace('@', '')}`, title: 'Homiy Kanal' }];
      }
    }

    const notJoined = [];
    for (const ch of channels) {
      if (!ch.username) continue;
      const uname = ch.username.startsWith('@') ? ch.username : `@${ch.username}`;
      try {
        const member = await ctx.api.getChatMember(uname, userId);
        if (['left', 'kicked'].includes(member.status)) {
          notJoined.push(ch);
        }
      } catch (err) {
        // If bot is not admin in channel, don't block user
      }
    }

    if (notJoined.length > 0) {
      return { ok: false, channels: notJoined };
    }
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

async function sendSponsorGate(ctx, notJoinedChannels, targetCode = '') {
  const userId = ctx.from.id;
  const userLang = db.getUserLang(userId) || 'uz';

  let text = `⚠️ <b>Botdan to'liq foydalanish uchun quyidagi kanallarga a'zo bo'ling:</b>\n\n`;
  const kb = new InlineKeyboard();

  notJoinedChannels.forEach((ch, idx) => {
    const title = ch.title || `${idx + 1}-Kanal`;
    const link = ch.link || `https://t.me/${ch.username?.replace('@', '')}`;
    text += `${idx + 1}. <a href="${link}">${escapeHTML(title)}</a>\n`;
    kb.url(`➕ ${title}`, link).row();
  });

  text += `\n<i>A'zo bo'lib, pastdagi «✅ Obunani tekshirish» tugmasini bosing:</i>`;
  kb.text('✅ Obunani tekshirish', targetCode ? `chk_sub:${targetCode}` : 'chk_sub:home');

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb, disable_web_page_preview: true });
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
  db.trackMovieView(code);

  safeLogActivity({
    bot: 'Kino Bot',
    type: 'user',
    actor: ctx.from?.first_name || '👤 Foydalanuvchi',
    icon: '🎬',
    text: `'${movie.title}' kinosi ko'rildi (Kod: ${code})`,
    color: '#d946ef'
  });

  const cleanTitle = escapeHTML(movie.title);
  const cleanGenre = escapeHTML((movie.genre || 'Tarjima kino').replace(/\s+/g, '_'));
  const cleanDesc = escapeHTML(movie.description || '');

  const caption = `🎬 <b>${cleanTitle}</b>\n\n🎭 Janr: #${cleanGenre}\n🔑 Kod: <code>${code}</code>\n\n📝 <i>${cleanDesc}</i>`;
  
  const likesCount = Array.isArray(movie.likes) ? movie.likes.length : (Number(movie.likes) || 0);
  const dislikesCount = Array.isArray(movie.dislikes) ? movie.dislikes.length : (Number(movie.dislikes) || 0);

  const baseUrl = process.env.MOVIE_MINI_APP_URL || 'https://xitfilm.uz';
  const miniAppUrl = `${baseUrl}?code=${code}&tma=1&v=4.2.0`;

  const keyboard = new InlineKeyboard()
    .text(`🔥 ${likesCount}`, `like:${code}`)
    .text(`❄️ ${dislikesCount}`, `dislike:${code}`)
    .row()
    .webApp(`📱 Ilovada ko'rish (HD Player)`, miniAppUrl);

  if (movie.youtubeUrl) {
    keyboard.row().url('📺 YouTubeda ko\'rish', movie.youtubeUrl);
  }

  const plainCaption = `🎬 ${movie.title}\n\nJanr: ${movie.genre || 'Tarjima kino'}\nKod: ${code}\n\n${movie.description || ''}`;

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
      console.error('sendMovie fallback error:', err2.message);
    }
  }
}

async function sendVipMenu(ctx) {
  const userId = ctx.from.id;
  const isVip = db.isUserPremium(userId);
  const users = db.getUsers() || [];
  const user = users.find(u => Number(u.id) === Number(userId));
  
  let statusText = isVip
    ? `✅ <b>Sizning VIP obunangiz faol!</b>\n⏳ Amal qilish muddati: <b>${user?.premiumUntil ? new Date(user.premiumUntil).toLocaleDateString('uz-UZ') : 'Cheksiz'}</b>\n\n`
    : `❌ <b>Sizda hozircha VIP obuna mavjud emas.</b>\n\n`;

  const text =
    `👑 <b>XIT FILM VIP Premium A'zolik</b>\n\n` +
    statusText +
    `<b>VIP a'zolikning afzalliklari:</b>\n` +
    `⚡️ <b>Reklamasiz tomosha</b> — sayt va botda umuman reklamasiz\n` +
    `🎬 <b>4K Ultra HD & 1080p Full HD</b> — eng yuqori sifat\n` +
    `🚀 <b>Cheksiz tezlik</b> — videolarni bir zumda yuklab olish\n` +
    `🍿 <b>Eksklyuziv Premyeralar</b> — yangi filmlarni birinchi ko'rish\n\n` +
    `<i>Telegram Stars (⭐️) orqali to'g'ridan-to'g'ri xarid qiling:</i>`;

  const kb = new InlineKeyboard()
    .text('⭐️ 1 Oylik VIP — 50 Stars', 'buy_vip:1m:50').row()
    .text('⭐️ 3 Oylik VIP — 120 Stars (Bonusli)', 'buy_vip:3m:120').row()
    .text('⭐️ 1 Yillik VIP — 350 Stars (Cheksiz)', 'buy_vip:1y:350').row()
    .webApp('🌐 Saytda VIP faollashtirish', 'https://xitfilm.uz?tma=1&v=4.2.0');

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

async function startBot(botToken) {
  if (isBotRunning && botInstance) return true;
  try {
    botInstance = new Bot(botToken);
    botInstance.catch((err) => console.error('Movie Grammy error:', err.message));

    // Global User Registration & Activity Tracking
    botInstance.use((ctx, next) => {
      if (ctx.from) {
        db.addUser(ctx.from);
        db.trackActiveUser(ctx.from.id);
      }
      return next();
    });

    // --- COMMANDS: /start, /admin, /boshqaruv, /help, /lang ---
    botInstance.command(['start', 'admin', 'boshqaruv'], async (ctx) => {
      const userId = ctx.from.id;
      const args = ctx.match ? String(ctx.match).trim() : '';

      if (ctx.from) db.addUser(ctx.from);
      userStates.delete(userId);

      // 1. Web Login via 6-digit Code
      if (args === 'login') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        db.saveAuthCode(userId, code, ctx.from);
        return await ctx.reply(`🔑 <b>Sizning bir martalik kirish kodingiz:</b>\n\n<code>${code}</code>\n\n◀️ Ushbu kodni saytga kiriting.`, { parse_mode: 'HTML' });
      }

      // Web Login via Link Token (One-Click)
      if (args && args.startsWith('login_')) {
        const token = args.replace('login_', '').trim();
        db.saveLinkLogin(token, ctx.from);
        return await ctx.reply(`🎉 <b>Muvaffaqiyatli kirildi!</b>\n\nBrauzerda XIT FILM sahifasiga qayting. Tizim sizni avtomatik kirgazib yubordi! 🌐`, { parse_mode: 'HTML' });
      }

      // 2. Admin Dashboard
      if (isAdmin(userId) && (ctx.message?.text?.includes('admin') || ctx.message?.text?.includes('boshqaruv'))) {
        return sendAdminDashboard(ctx);
      }

      // 3. Deep Link (Movie code)
      if (args && args !== 'login') {
        const sub = await checkSponsorSubscription(ctx, userId);
        if (!sub.ok) {
          return await sendSponsorGate(ctx, sub.channels, args);
        }
        const movie = db.getMovieByCode(args);
        if (movie) {
          return await sendMovie(ctx, movie);
        }
      }

      const userLang = db.getUserLang(userId) || 'uz';
      const welcomeMsg = i18n.t(userLang, 'welcome', { name: escapeHTML(ctx.from.first_name) });
      
      try {
        await ctx.api.setChatMenuButton({
          chat_id: ctx.chat.id,
          menu_button: {
            type: 'web_app',
            text: '🎬 Kinolar (HD)',
            web_app: { url: 'https://xitfilm.uz?tma=1&v=4.2.0' }
          }
        });
      } catch (e) {}

      await ctx.reply(welcomeMsg, { parse_mode: 'Markdown', reply_markup: getMainKeyboard(userLang) });
    });

    botInstance.command('help', async (ctx) => {
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      await ctx.reply(i18n.t(userLang, 'help_text'), { parse_mode: 'Markdown', reply_markup: getMainKeyboard(userLang) });
    });

    botInstance.command('lang', async (ctx) => {
      await sendLanguageSelector(ctx);
    });

    botInstance.command(['vip', 'stars', 'premium', 'star'], async (ctx) => {
      await sendVipMenu(ctx);
    });

    botInstance.command(['shorts', 'lavha'], async (ctx) => {
      const kb = new InlineKeyboard()
        .webApp('⚡️ Shorts Tasmasini Ochish', 'https://xitfilm.uz/shorts.html?tma=1&v=4.3.0')
        .row()
        .url('🤝 Hamkor Bo\'lish (Creator Park)', 'https://xitfilm.uz/creators.html');

      await ctx.reply(
        `⚡️ <b>XIT FILM Shorts — Qisqa Kino Lavhalari</b>\n\n` +
        `🍿 Eng sara filmlardan poyga, jang va qiziqarli lavhalarni Reels/TikTok formatida tomosha qiling!\n\n` +
        `<i>Pastdagi tugmani bosing:</i>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    });

    botInstance.command(['post', 'kanal'], async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const movies = db.getMovies() || [];
      const latest = movies.slice(-8).reverse();

      let text = `📢 <b>KANALGA POST JOYLASHTIRISH BOSHQARUVI:</b>\n\nQaysi filmni @XitFilm_uz kanaliga chiqarmoqchisiz? Tanlang:`;
      const kb = new InlineKeyboard();
      latest.forEach((m, idx) => {
        kb.text(`🎬 ${m.title.substring(0, 20)} (${m.code})`, `pub_chan_now:${m.code}`);
        if (idx % 2 === 1) kb.row();
      });

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    });

    // --- BUTTON / TEXT HANDLERS ---
    botInstance.hears([/Shorts/i, /Лавхалар/i, /Lavhalar/i], async (ctx) => {
      const kb = new InlineKeyboard()
        .webApp('⚡️ Shorts Tasmasini Ochish', 'https://xitfilm.uz/shorts.html?tma=1&v=4.3.0')
        .row()
        .url('🤝 Hamkor Bo\'lish (Creator Park)', 'https://xitfilm.uz/creators.html');

      await ctx.reply(
        `⚡️ <b>XIT FILM Shorts — Qisqa Kino Lavhalari</b>\n\n` +
        `🍿 Eng sara filmlardan poyga, jang va qiziqarli lavhalarni Reels/TikTok formatida tomosha qiling!\n\n` +
        `<i>Pastdagi tugmani bosing:</i>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    });

    botInstance.hears([/Kino Qidirish/i, /Поиск фильма/i, /Search Movie/i], async (ctx) => {
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'search', timestamp: Date.now() });
      const userLang = db.getUserLang(userId) || 'uz';
      await ctx.reply(i18n.t(userLang, 'searching'), { parse_mode: 'Markdown' });
    });

    botInstance.hears([/VIP/i, /Премиум/i, /Premium/i, /⭐️/i], async (ctx) => {
      await sendVipMenu(ctx);
    });

    botInstance.hears([/Janrlar/i, /Жанры/i, /Genres/i], async (ctx) => {
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      const genres = db.getGenres() || [];
      const kb = new InlineKeyboard();
      genres.forEach((g, i) => {
        kb.text(`🎬 ${g}`, `genre:${g}:1`);
        if (i % 2 === 1) kb.row();
      });
      await ctx.reply(i18n.t(userLang, 'genre_select'), { parse_mode: 'Markdown', reply_markup: kb });
    });

    botInstance.hears([/Buyurtma berish/i, /Kino so'rash/i, /Заказать фильм/i, /Request Movie/i], async (ctx) => {
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'request', timestamp: Date.now() });
      const userLang = db.getUserLang(userId) || 'uz';
      await ctx.reply(i18n.t(userLang, 'req_prompt'), { parse_mode: 'Markdown' });
    });

    botInstance.hears([/Yordam/i, /Помощь/i, /Help/i], async (ctx) => {
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      await ctx.reply(i18n.t(userLang, 'help_text'), { parse_mode: 'Markdown', reply_markup: getMainKeyboard(userLang) });
    });

    botInstance.hears([/Tilni o'zgartirish/i, /Сменить язык/i, /Change Language/i], async (ctx) => {
      await sendLanguageSelector(ctx);
    });

    // --- CALLBACK QUERIES ---

    // Movie code selection
    botInstance.callbackQuery(/^mv:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      const sub = await checkSponsorSubscription(ctx, ctx.from.id);
      if (!sub.ok) {
        await ctx.answerCallbackQuery();
        return await sendSponsorGate(ctx, sub.channels, code);
      }
      const movie = db.getMovieByCode(code);
      if (movie) await sendMovie(ctx, movie);
      await ctx.answerCallbackQuery();
    });

    // Likes & Dislikes
    botInstance.callbackQuery(/^(like|dislike):(.+)$/, async (ctx) => {
      const action = ctx.match[1];
      const code = ctx.match[2];
      const userId = ctx.from.id;

      const updated = db.toggleLikeDislike(code, userId, action);
      if (updated) {
        const likesCount = Array.isArray(updated.likes) ? updated.likes.length : 0;
        const dislikesCount = Array.isArray(updated.dislikes) ? updated.dislikes.length : 0;

        const newKb = new InlineKeyboard()
          .text(`🔥 ${likesCount}`, `like:${code}`)
          .text(`❄️ ${dislikesCount}`, `dislike:${code}`);

        if (updated.youtubeUrl) {
          newKb.row().url('📺 YouTubeda ko\'rish', updated.youtubeUrl);
        }

        try {
          await ctx.editMessageReplyMarkup({ reply_markup: newKb });
        } catch (e) {}
        await ctx.answerCallbackQuery({ text: action === 'like' ? '🔥 Like qo\'shildi!' : '❄️ Fikr bildirildi!' });
      } else {
        await ctx.answerCallbackQuery();
      }
    });

    // Sponsor Check Callback
    botInstance.callbackQuery(/^chk_sub:(.+)$/, async (ctx) => {
      const targetCode = ctx.match[1];
      const sub = await checkSponsorSubscription(ctx, ctx.from.id);
      if (sub.ok) {
        await ctx.answerCallbackQuery({ text: 'Azo bo\'lganingiz tasdiqlandi! ✅' });
        try { await ctx.deleteMessage(); } catch (e) {}
        if (targetCode && targetCode !== 'home') {
          const movie = db.getMovieByCode(targetCode);
          if (movie) return await sendMovie(ctx, movie);
        }
        const userLang = db.getUserLang(ctx.from.id) || 'uz';
        await ctx.reply(`🎉 Rahmat! Botdan to'liq foydalanishingiz mumkin.`, { reply_markup: getMainKeyboard(userLang) });
      } else {
        await ctx.answerCallbackQuery({ text: 'Hali barcha kanallarga a\'zo bo\'lmadingiz! ❌', show_alert: true });
      }
    });

    // Language selection callback
    botInstance.callbackQuery(/^setlang:(uz|ru|en)$/, async (ctx) => {
      const lang = ctx.match[1];
      db.setUserLang(ctx.from.id, lang);
      await ctx.answerCallbackQuery({ text: 'OK' });
      const msg = i18n.t(lang, 'lang_changed');
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: getMainKeyboard(lang) });
    });

    // Genre browsing callback
    botInstance.callbackQuery(/^genre:(.+):(\d+)$/, async (ctx) => {
      const genre = ctx.match[1];
      const page = parseInt(ctx.match[2], 10) || 1;
      const userLang = db.getUserLang(ctx.from.id) || 'uz';

      const allMovies = db.getMovies() || [];
      const genreMovies = allMovies.filter(m => String(m.genre || '').toLowerCase().includes(genre.toLowerCase()));

      if (genreMovies.length === 0) {
        await ctx.answerCallbackQuery({ text: i18n.t(userLang, 'genre_empty', { genre }), show_alert: true });
        return;
      }

      const pageSize = 6;
      const totalPages = Math.ceil(genreMovies.length / pageSize) || 1;
      const curPage = Math.min(Math.max(1, page), totalPages);
      const start = (curPage - 1) * pageSize;
      const paged = genreMovies.slice(start, start + pageSize);

      let text = `🗂 <b>${escapeHTML(genre)}</b> janridagi kinolar (Sahifa ${curPage}/${totalPages}):\n\n`;
      const kb = new InlineKeyboard();

      paged.forEach((m, idx) => {
        text += `${start + idx + 1}. 🎬 <b>${escapeHTML(m.title)}</b> (Kod: <code>${m.code}</code>)\n`;
        kb.text(`🍿 ${m.code}`, `mv:${m.code}`);
        if (idx % 2 === 1) kb.row();
      });

      if (paged.length % 2 === 1) kb.row();

      // Pagination row
      const navRow = [];
      if (curPage > 1) navRow.push({ text: '◀️ Oldingi', data: `genre:${genre}:${curPage - 1}` });
      if (curPage < totalPages) navRow.push({ text: 'Keyingi ▶️', data: `genre:${genre}:${curPage + 1}` });

      navRow.forEach(n => kb.text(n.text, n.data));
      kb.row().text('🔙 Barcha Janrlar', 'all_genres');

      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.answerCallbackQuery();
    });

    botInstance.callbackQuery('all_genres', async (ctx) => {
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      const genres = db.getGenres() || [];
      const kb = new InlineKeyboard();
      genres.forEach((g, i) => {
        kb.text(`🎬 ${g}`, `genre:${g}:1`);
        if (i % 2 === 1) kb.row();
      });
      await ctx.editMessageText(i18n.t(userLang, 'genre_select'), { parse_mode: 'Markdown', reply_markup: kb });
      await ctx.answerCallbackQuery();
    });

    // Request new movie callback
    botInstance.callbackQuery('req_new', async (ctx) => {
      userStates.set(ctx.from.id, { action: 'request', timestamp: Date.now() });
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      await ctx.reply(i18n.t(userLang, 'req_prompt'), { parse_mode: 'Markdown' });
      await ctx.answerCallbackQuery();
    });

    // --- Admin Callbacks ---
    botInstance.callbackQuery('adm_refresh', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const advStats = db.getAdvancedStats();
      const pendingReqs = (db.getRequests() || []).filter(r => r.status === 'pending').length;
      const dashboardText =
        `📊 <b>XIT FILM — DASHBOARD</b> (Yangilandi)\n\n` +
        `⚙️ <b>STATUS:</b>\n` +
        `┣ 👥 Foydalanuvchilar: <b>${advStats.totalUsers} ta</b>\n` +
        `┣ 🎬 Kinolar bazasi: <b>${advStats.totalMovies} ta</b>\n` +
        `┣ 📥 Buyurtmalar: <b>${pendingReqs} ta</b>\n` +
        `┗ ⚡️ Bugungi yangi: <b>+${advStats.growth?.newUsersToday || 0} ta</b>`;
      await ctx.editMessageText(dashboardText, { parse_mode: 'HTML', reply_markup: ctx.callbackQuery.message.reply_markup });
      await ctx.answerCallbackQuery({ text: 'Yangilandi ✅' });
    });

    botInstance.callbackQuery('adm_stats', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const advStats = db.getAdvancedStats();
      const text =
        `📈 <b>BATAFSIL STATISTIKA:</b>\n\n` +
        `👥 Jami foydalanuvchilar: <b>${advStats.totalUsers}</b>\n` +
        `🎬 Jami kinolar: <b>${advStats.totalMovies}</b>\n` +
        `👁 Jami ko'rishlar: <b>${advStats.totalViews || 0}</b>\n\n` +
        `📊 <b>O'sish dinamikasi:</b>\n` +
        `┣ Bugun: <b>+${advStats.growth?.newUsersToday || 0}</b>\n` +
        `┣ Bu hafta: <b>+${advStats.growth?.newUsersWeek || 0}</b>\n` +
        `┗ Bu oy: <b>+${advStats.growth?.newUsersMonth || 0}</b>`;
      const kb = new InlineKeyboard().text('◀️ Orqaga', 'adm_refresh');
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.answerCallbackQuery();
    });

    botInstance.callbackQuery('adm_requests', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const reqs = (db.getRequests() || []).filter(r => r.status === 'pending');
      let text = `📥 <b>Kutilayotgan Buyurtmalar (${reqs.length} ta):</b>\n\n`;
      if (reqs.length === 0) {
        text += `<i>Hozircha yangi buyurtmalar yo'q.</i>`;
      } else {
        reqs.slice(0, 10).forEach((r, i) => {
          text += `${i + 1}. <b>${escapeHTML(r.title)}</b> (User: ${r.userId})\n`;
        });
      }
      const kb = new InlineKeyboard().text('◀️ Orqaga', 'adm_refresh');
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.answerCallbackQuery();
    });

    botInstance.callbackQuery('adm_movies', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const movies = db.getMovies() || [];
      const sorted = [...movies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
      let text = `🎬 <b>Eng Ko'p Ko'rilgan Top-8 Kinolar:</b>\n\n`;
      sorted.forEach((m, i) => {
        text += `${i + 1}. <b>${escapeHTML(m.title)}</b> (Kod: <code>${m.code}</code>) — 👁 ${m.views || 0}\n`;
      });
      const kb = new InlineKeyboard().text('◀️ Orqaga', 'adm_refresh');
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.answerCallbackQuery();
    });

    // --- ADMIN SHORTS & CHANNEL AUTO-POST CALLBACKS ---
    botInstance.callbackQuery(/^up_shorts:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      userStates.set(ctx.from.id, { action: 'awaiting_shorts', code });
      await ctx.editMessageText(
        `📹 <b>Kino Kodi: <code>${code}</code></b>\n\n` +
        `Iltimos, ushbu film uchun <b>1-2 daqiqalik qiziqarli Shorts (lavha / treyler) videosini</b> shu chatga yuboring:`,
        { parse_mode: 'HTML' }
      );
      await ctx.answerCallbackQuery();
    });

    botInstance.callbackQuery(/^skip_shorts:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      const movie = db.getMovieByCode(code);
      const kb = new InlineKeyboard()
        .text('🚀 Ha, darhol joylash', `pub_chan_now:${code}`)
        .row()
        .text('⏰ Keyinroq eslat', `remind_chan:${code}`)
        .row()
        .text('❌ Kerak emas', `cancel_chan:${code}`);

      await ctx.editMessageText(
        `📢 <b>Telegram kanalga (@XitFilm_uz) chiroyli post joylansinmi?</b>\n\n` +
        `🎬 Film: <b>${escapeHTML(movie?.title || code)}</b>\n` +
        `🔑 Kodi: <code>${code}</code>\n\n` +
        `<i>Tanlang:</i>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
      await ctx.answerCallbackQuery();
    });

    botInstance.callbackQuery(/^pub_chan_now:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      const movie = db.getMovieByCode(code);
      if (!movie) return await ctx.answerCallbackQuery({ text: 'Kino topilmadi', show_alert: true });

      await ctx.answerCallbackQuery({ text: 'Kanalga joylanmoqda...' });
      try {
        await publishMoviePostToChannel(movie, movie.shortsFileId || null);
        await ctx.editMessageText(
          `✅ <b>MUVAFFAQIYATLI JOYLANDI!</b>\n\n` +
          `🎬 <b>«${escapeHTML(movie.title)}»</b> (Kod: <code>${code}</code>) filmi @XitFilm_uz kanaliga chiroyli post qilib chiqarildi! 🚀`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await ctx.editMessageText(`❌ Kanalga post qilishda xatolik: ${err.message}`);
      }
    });

    botInstance.callbackQuery(/^remind_chan:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      await ctx.editMessageText(
        `⏰ <b>Eslab qolindi!</b>\n\n` +
        `Kino kodi: <code>${code}</code>\n` +
        `Ushbu postni xohlagan vaqtingizda /post buyrug'i orqali kanalga chiqarishingiz mumkin.`,
        { parse_mode: 'HTML' }
      );
      await ctx.answerCallbackQuery({ text: 'Eslatma saqlandi!' });
    });

    botInstance.callbackQuery(/^cancel_chan:(.+)$/, async (ctx) => {
      await ctx.editMessageText(
        `❌ <b>Kanalga post joylanmadi.</b>\n\nFilm faqat bot bazasida saqlandi.`,
        { parse_mode: 'HTML' }
      );
      await ctx.answerCallbackQuery();
    });

    // --- STARS VIP PURCHASE CALLBACKS ---
    botInstance.callbackQuery(/^buy_vip:(1m|3m|1y):(\d+)$/, async (ctx) => {
      const plan = ctx.match[1];
      const stars = parseInt(ctx.match[2], 10);
      const days = plan === '1m' ? 30 : plan === '3m' ? 90 : 365;
      const planName = plan === '1m' ? '1 Oylik VIP' : plan === '3m' ? '3 Oylik VIP' : '1 Yillik VIP';

      await ctx.answerCallbackQuery();
      await ctx.replyWithInvoice(
        `👑 XIT FILM VIP (${planName})`,
        `Barcha filmlarni 4K sifatda va reklamasiz tomosha qilish uchun ${days} kunlik VIP obuna`,
        `vip_${plan}_${ctx.from.id}_${Date.now()}`,
        '', // Telegram Stars empty provider token
        'XTR',
        [{ label: `👑 ${planName}`, amount: stars }]
      );
    });

    // --- PRE-CHECKOUT QUERY (Telegram Stars) ---
    botInstance.on('pre_checkout_query', async (ctx) => {
      try {
        await ctx.answerPreCheckoutQuery(true);
      } catch (e) {
        console.error('Pre-checkout error:', e.message);
      }
    });

    // --- SUCCESSFUL PAYMENT HANDLER ---
    botInstance.on(':successful_payment', async (ctx) => {
      const payment = ctx.message.successful_payment;
      const payload = payment.invoice_payload || '';
      const stars = payment.total_amount;
      const userId = ctx.from.id;

      let days = 30;
      if (payload.includes('3m')) days = 90;
      if (payload.includes('1y')) days = 365;

      db.addVipStarsPayment(userId, days, stars, payment);

      safeLogActivity({
        bot: 'Kino Bot',
        type: 'payment',
        actor: ctx.from?.first_name || '👤 Foydalanuvchi',
        icon: '⭐️',
        text: `⭐️ ${stars} Stars to'landi (${days} kunlik VIP)`,
        color: '#fbbf24'
      });

      const kb = new InlineKeyboard()
        .webApp('🍿 Kinolarni Ko\'rish', 'https://xitfilm.uz?tma=1&v=4.2.0');

      await ctx.reply(
        `🎉 <b>Xaridingiz uchun tashakkur!</b>\n\n` +
        `⭐️ <b>${stars} Telegram Stars</b> muvaffaqiyatli qabul qilindi.\n` +
        `👑 Sizga <b>${days} kunlik VIP Premium</b> statusi berildi!\n\n` +
        `Endi sayt va botda barcha filmlar siz uchun 4K formatda va reklamasiz ochiq. Maroqli tomosha tilaymiz! 🍿`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    });

    // --- PREMYERA QO'NG'IROG'I CALLBACK ---
    botInstance.callbackQuery(/^sub_alert:(.+)$/, async (ctx) => {
      const query = ctx.match[1].trim();
      db.subscribeMovieAlert(ctx.from.id, query);
      await ctx.answerCallbackQuery({ text: '🔔 Eslab qolindi! Kino qo\'shilishi bilan sizga xabar beramiz.', show_alert: true });
      try {
        await ctx.editMessageText(
          `🔔 <b>Premyera Qo'ng'irog'i faollashtirildi!</b>\n\n` +
          `🎬 <b>«${escapeHTML(query)}»</b> filmi bazaga qo'shilishi bilanoq sizga avtomatik bildirishnoma yuboramiz. Rahmat!`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    });

    // --- INLINE QUERY HANDLER (Search & Share in any chat) ---
    botInstance.on('inline_query', async (ctx) => {
      try {
        const query = (ctx.inlineQuery.query || '').trim().toLowerCase();
        const allMovies = db.getMovies() || [];
        let matches = [];

        if (!query) {
          matches = [...allMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 20);
        } else {
          matches = allMovies.filter(m => (m.title + ' ' + (m.genre || '') + ' ' + m.code).toLowerCase().includes(query)).slice(0, 20);
        }

        const botUsername = botInstance.botInfo?.username || 'xitfilm_bot';

        const inlineResults = matches.map((m, idx) => {
          const code = String(m.code).trim();
          const title = m.title || `Kino #${code}`;
          const genre = m.genre || 'Tarjima kino';
          const rating = m.rating || 8.5;
          const year = m.year || 2024;
          const desc = m.description || 'XIT FILM portalida eng yuqori sifatda tomosha qiling.';
          const poster = m.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400';
          const miniAppUrl = `https://xitfilm.uz?code=${code}&tma=1&v=4.2.0`;

          const cleanTitle = escapeHTML(title);
          const cleanDesc = escapeHTML(desc.substring(0, 220));

          const messageText =
            `🎬 <b>${cleanTitle}</b>\n\n` +
            `🎭 Janr: #${escapeHTML(genre.replace(/\s+/g, '_'))}\n` +
            `⭐️ IMDb: <b>${rating}</b> | 📅 Yil: <b>${year}</b>\n` +
            `🔑 Kod: <code>${code}</code>\n\n` +
            `📝 <i>${cleanDesc}</i>`;

          const replyMarkup = new InlineKeyboard()
            .webApp(`📱 Ilovada ko'rish (HD)`, miniAppUrl)
            .row()
            .url(`🍿 Botda yuklab olish`, `https://t.me/${botUsername}?start=${code}`);

          return {
            type: 'article',
            id: `inline_mv_${code}_${idx}`,
            title: `${title} (${year})`,
            description: `⭐️ ${rating} • #${genre} • Kod: ${code}`,
            thumbnail_url: poster,
            input_message_content: {
              message_text: messageText,
              parse_mode: 'HTML'
            },
            reply_markup: replyMarkup
          };
        });

        await ctx.answerInlineQuery(inlineResults, {
          cache_time: 30,
          is_personal: false
        });
      } catch (err) {
        console.error('Inline query error:', err.message);
      }
    });

    // --- ADMIN VIDEO & SHORTS UPLOAD HANDLER ---
    botInstance.on(['message:video', 'message:document'], async (ctx) => {
      const userId = ctx.from.id;
      if (!isAdmin(userId)) return;

      const isVideo = !!ctx.message.video;
      const isDoc = !!ctx.message.document;
      const docMime = ctx.message.document?.mime_type || '';
      if (isDoc && !docMime.startsWith('video/')) return;

      const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id;
      if (!fileId) return;

      const state = userStates.get(userId);

      // A. Admin is uploading requested Shorts video
      if (state && state.action === 'awaiting_shorts') {
        const code = state.code;
        userStates.delete(userId);

        const movie = db.getMovieByCode(code);
        if (movie) {
          movie.shortsFileId = fileId;
          db.addShort({
            movieCode: code,
            movieTitle: movie.title,
            videoUrl: fileId,
            title: `${movie.title} (Shorts)`,
            views: 0
          });
        }

        const kb = new InlineKeyboard()
          .text('🚀 Ha, darhol joylash', `pub_chan_now:${code}`)
          .row()
          .text('⏰ Keyinroq eslat', `remind_chan:${code}`)
          .row()
          .text('❌ Kerak emas', `cancel_chan:${code}`);

        return await ctx.reply(
          `✅ <b>Shorts video qabul qilindi!</b>\n\n` +
          `📢 <b>Kanalga (@XitFilm_uz) chiroyli post joylansinmi?</b>\n\n` +
          `🎬 Film: <b>${escapeHTML(movie?.title || code)}</b>\n` +
          `🔑 Kodi: <code>${code}</code>\n\n` +
          `<i>Post bilan birga hozirgina yuklangan Shorts lavhasi ham aylanib turadi!</i>`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }

      // B. Admin is uploading a Full Movie video
      const caption = ctx.message.caption || '';
      let code = getNextMovieCode();
      let title = caption || ctx.message.document?.file_name || `Kino #${code}`;
      title = title.replace(/\.[^/.]+$/, ''); // remove extension

      const codeMatch = caption.match(/#(\d+)|kod[:\s]*(\d+)/i);
      if (codeMatch) {
        code = codeMatch[1] || codeMatch[2];
        title = caption.replace(/#\d+|kod[:\s]*\d+/gi, '').trim() || title;
      }

      db.addMovie({
        code,
        title,
        fileId,
        genre: 'Tarjima kino',
        description: 'XIT FILM portalida eng yuqori sifatda tomosha qiling.',
        dateAdded: new Date().toISOString()
      });

      const kb = new InlineKeyboard()
        .text('📹 Ha, Shorts yuklayman', `up_shorts:${code}`)
        .row()
        .text('⏩ O\'tkazib yuborish', `skip_shorts:${code}`);

      await ctx.reply(
        `🎉 <b>YANGI FILM QABUL QILINDI VA BAZAGA SAQLANDI!</b>\n\n` +
        `🎬 Nomi: <b>${escapeHTML(title)}</b>\n` +
        `🔑 Kodi: <code>${code}</code>\n\n` +
        `📹 <b>Kanal uchun Shorts (treyler / qiziqarli lavha) videosini ham yuklaysizmi?</b>\n\n` +
        `<i>💡 Shorts videosi kanalda odamlarni o'ziga jalb qiladi va ko'rishlar sonini 5 baravarga oshiradi!</i>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    });

    // --- MAIN TEXT MESSAGE HANDLER ---
    botInstance.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return;

      const userId = ctx.from.id;
      const userLang = db.getUserLang(userId) || 'uz';
      const state = userStates.get(userId);

      // 1. Handle movie order/request state
      if (state && state.action === 'request') {
        userStates.delete(userId);
        db.addRequest(text, userId, ctx.from.first_name || ctx.from.username || String(userId));
        safeLogActivity({
          bot: 'Kino Bot',
          type: 'user',
          actor: ctx.from?.first_name || '👤 Foydalanuvchi',
          icon: '📩',
          text: `Yangi kino buyurtma qilindi: '${text}'`,
          color: '#ec4899'
        });
        const successMsg = i18n.t(userLang, 'req_success', { title: escapeHTML(text) });
        return await ctx.reply(successMsg, { parse_mode: 'Markdown', reply_markup: getMainKeyboard(userLang) });
      }

      // 2. Search state or direct code/name lookup
      userStates.delete(userId);

      // Check sponsor subscription
      const sub = await checkSponsorSubscription(ctx, userId);

      // Exact code match
      const movie = db.getMovieByCode(text);
      if (movie) {
        if (!sub.ok) {
          return await sendSponsorGate(ctx, sub.channels, movie.code);
        }
        return await sendMovie(ctx, movie);
      }

      // Search by title/keywords
      const results = db.searchMovies(text);
      if (results && results.length > 0) {
        if (!sub.ok) {
          return await sendSponsorGate(ctx, sub.channels, results[0].code);
        }
        if (results.length === 1) {
          return await sendMovie(ctx, results[0]);
        }

        let listText = `🔍 <b>"${escapeHTML(text)}" bo'yicha topilgan kinolar:</b>\n\n`;
        const kb = new InlineKeyboard();
        results.slice(0, 8).forEach((m, i) => {
          listText += `${i + 1}. 🎬 <b>${escapeHTML(m.title)}</b> (Kod: <code>${m.code}</code>)\n`;
          kb.text(`🍿 ${m.code}`, `mv:${m.code}`);
          if (i % 2 === 1) kb.row();
        });

        await ctx.reply(listText, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        const cleanQuery = escapeHTML(text);
        const notFoundText =
          `😔 Kechirasiz, <b>«${cleanQuery}»</b> nomli film hozircha bazada topilmadi.\n\n` +
          `<i>Film bazaga qo'shilishi bilan sizga xabar beraylikmi?</i>`;
        const kb = new InlineKeyboard()
          .text('🔔 Meni xabardor qiling (Premyera)', `sub_alert:${text.substring(0, 30)}`).row()
          .text('🙋‍♂️ Kinoni buyurtma qilish', 'req_new');
        await ctx.reply(notFoundText, { parse_mode: 'HTML', reply_markup: kb });
      }
    });

    let reconnectTimer = null;
    async function launchPolling() {
      if (!botInstance) return;
      try {
        try {
          await botInstance.api.deleteWebhook({ drop_pending_updates: false });
        } catch (e) {}

        isBotRunning = true;
        await botInstance.start({
          allowed_updates: ['message', 'callback_query', 'inline_query', 'chat_member', 'my_chat_member'],
          onStart: (info) => {
            console.log(`Movie Bot @${info.username} started.`);
            initResumeReminderScheduler();
          }
        });
      } catch (err) {
        console.error('Movie Bot polling error:', err.message);
        isBotRunning = false;
        if (!botInstance) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (botInstance) launchPolling();
        }, 5000);
      }
    }

    launchPolling();
    return true;
  } catch (err) {
    console.error('Movie Bot start error:', err.message);
    isBotRunning = false;
    return false;
  }
}

let resumeInterval = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function initResumeReminderScheduler() {
  if (resumeInterval) clearInterval(resumeInterval);
  // Check every 10 minutes for users who stopped watching > 2 hours ago
  resumeInterval = setInterval(async () => {
    if (!botInstance || !isBotRunning) return;
    try {
      const pending = db.getPendingResumeNotifications();
      if (!pending || pending.length === 0) return;

      const baseUrl = process.env.MOVIE_MINI_APP_URL || 'https://xitfilm.uz';

      for (const item of pending) {
        try {
          const timeStr = formatTime(item.currentTime);
          const resumeUrl = `${baseUrl}?code=${item.code}&resume=1&tma=1`;
          const cleanTitle = escapeHTML(item.title);

          const text =
            `🍿 <b>Ko'rishni davom ettirasizmi?</b>\n\n` +
            `Siz <b>«${cleanTitle}»</b> filmini <b>${timeStr}</b> daqiqasida to'xtatib qoldingiz.\n\n` +
            `<i>Filmni to'xtagan joyidan qulay va professional HD pleyerda tomosha qilish uchun quyidagi tugmani bosing:</i>`;

          const kb = new InlineKeyboard()
            .webApp(`▶️ Davom ettirish (${timeStr})`, resumeUrl)
            .row()
            .url(`🎬 Botda ko'rish`, `https://t.me/${botInstance.botInfo?.username || 'xitfilm_bot'}?start=${item.code}`);

          await botInstance.api.sendMessage(item.userId, text, {
            parse_mode: 'HTML',
            reply_markup: kb
          });

          db.markResumeNotified(item.userId, item.code);
          await new Promise(r => setTimeout(r, 120)); // rate limit protection
        } catch (e) {
          // If user blocked or chat not found, mark notified
          db.markResumeNotified(item.userId, item.code);
        }
      }
    } catch (err) {
      console.error('Resume scheduler error:', err.message);
    }
  }, 10 * 60 * 1000);
}

async function sendLanguageSelector(ctx) {
  const kb = new InlineKeyboard()
    .text("O'zbekcha 🇺🇿", 'setlang:uz')
    .text('Русский 🇷🇺', 'setlang:ru')
    .row()
    .text('English 🇬🇧', 'setlang:en');
  await ctx.reply('🌐 **Iltimos, tilni tanlang / Пожалуйста, выберите язык:**', { parse_mode: 'Markdown', reply_markup: kb });
}

async function sendAdminDashboard(ctx) {
  const advStats = db.getAdvancedStats();
  const pendingReqs = (db.getRequests() || []).filter(r => r.status === 'pending').length;

  const dashboardText =
    `👑 <b>XIT FILM — ENTERPRISE ADMIN DASHBOARD</b>\n\n` +
    `🌐 Server: <b>Online</b> | 🚀 Uptime: <b>Faol</b>\n\n` +
    `📊 <b>ASOSIY MONITORING:</b>\n` +
    `┣ 👥 Jami foydalanuvchilar: <b>${advStats.totalUsers} ta</b>\n` +
    `┣ 🎬 Jami kinolar bazasi: <b>${advStats.totalMovies} ta</b>\n` +
    `┣ 📥 Kutilayotgan buyurtmalar: <b>${pendingReqs} ta</b>\n` +
    `┗ ⚡️ Bugungi yangi userlar: <b>+${advStats.growth?.newUsersToday || 0} ta</b>\n\n` +
    `🎯 <b>Bo'limni tanlash uchun tugmalarni bosing:</b>`;

  const keyboard = new InlineKeyboard()
    .text('📈 Analitika & Grafik', 'adm_stats').text(`📩 Buyurtmalar (${pendingReqs})`, 'adm_requests').row()
    .text('🎬 Kinolar Top-8', 'adm_movies').text('🔄 Refresh', 'adm_refresh').row()
    .url('🌐 Web Admin Panel', 'https://xitfilm.uz/panel/');

  return await ctx.reply(dashboardText, { parse_mode: 'HTML', reply_markup: keyboard });
}

async function stopBot() { if (botInstance) await botInstance.stop(); isBotRunning = false; return true; }

async function notifyNewMovie(movie) {
  if (!botInstance) return false;
  try {
    const settings = db.getMovieSettings() || {};
    const autoPostEnabled = settings.autoPostEnabled !== false;
    const channel = settings.autoPostChannel || process.env.AUTO_POST_CHANNEL || '';

    if (!autoPostEnabled || !channel) return false;

    const cleanTitle = escapeHTML(movie.title || '');
    const cleanGenre = escapeHTML((movie.genre || 'Tarjima kino').replace(/\s+/g, '_'));
    const cleanDesc = escapeHTML(movie.description || '');

    const caption =
      `🎬 <b>YANGI KINO QO'SHILDI!</b>\n\n` +
      `🎬 <b>${cleanTitle}</b>\n` +
      `🎭 Janr: #${cleanGenre}\n` +
      `🔑 Kod: <code>${movie.code}</code>\n\n` +
      `📝 <i>${cleanDesc}</i>`;

    const botUsername = botInstance.botInfo?.username || process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
    const keyboard = new InlineKeyboard().url('📥 Botda ko\'rish', `https://t.me/${botUsername}?start=${movie.code}`);

    if (movie.poster) {
      await botInstance.api.sendPhoto(channel, movie.poster, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    } else if (movie.fileId) {
      await botInstance.api.sendVideo(channel, movie.fileId, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await botInstance.api.sendMessage(channel, caption, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return true;
  } catch (err) {
    console.error('notifyNewMovie error:', err.message);
    return false;
  }
}

module.exports = { startBot, stopBot, getBotInstance, notifyNewMovie };
