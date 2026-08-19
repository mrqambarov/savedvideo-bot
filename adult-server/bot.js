const { Bot, InputFile, InlineKeyboard, Keyboard } = require('grammy');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const i18n = require('./i18n');

let botInstance = null;
let isBotRunning = false;
let reconnectTimer = null;
const userPendingActions = new Map();

// Birlamchi Telegram ID raqami
const PRIMARY_ADMIN = 6263659922;

function isAdmin(userId) {
  const adminIdsStr = process.env.ADULT_ADMIN_IDS || process.env.ADMIN_ID || '';
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

function extractChannelUsername(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/https?:\/\/t\.me\//i, '');
  str = str.replace(/https?:\/\/telegram\.me\//i, '');
  str = str.replace(/^@/, '');
  return str.split('/')[0].trim();
}

function getChannelLink(ch) {
  if (ch && ch.link && String(ch.link).startsWith('http')) {
    return String(ch.link).trim();
  }
  const uname = extractChannelUsername(ch?.username);
  if (uname) {
    return `https://t.me/${uname}`;
  }
  return 'https://t.me';
}

function getUserKeyboard() {
  return new Keyboard()
    .text('🔍 Video Qidirish').text('📂 Janrlar')
    .row()
    .text('🔥 Top Videolar').text('❓ Yordam')
    .resized();
}

function getSingleBoshqaruvKeyboard() {
  return new Keyboard()
    .text('🔍 Video Qidirish').text('📂 Janrlar')
    .row()
    .text('🔥 Top Videolar').text('⚡️ Boshqaruv')
    .resized();
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

    let channels = db.getChannels();
    if (!Array.isArray(channels) || channels.length === 0) {
      const channelUsername = process.env.ADULT_SPONSOR_CHANNEL_USERNAME || '@ehtiroslikodlar';
      const channelLink = process.env.ADULT_SPONSOR_CHANNEL_LINK || 'https://t.me/ehtiroslikodlar';
      if (channelUsername) {
        channels = [{ id: '1', title: 'Homiy Kanal', username: channelUsername, link: channelLink }];
      }
    }

    if (!channels || channels.length === 0) return { ok: true };

    const notJoined = [];
    for (const ch of channels) {
      if (!ch) continue;
      if (db.hasJoinedOrRequested && db.hasJoinedOrRequested(userId, ch)) {
        continue;
      }

      const uname = extractChannelUsername(ch.username);
      if (!uname) continue;

      try {
        const sm = require(path.resolve(__dirname, '../server/sponsorManager'));
        if (sm && typeof sm.recordChannelCheck === 'function') {
          sm.recordChannelCheck('@' + uname);
        }
      } catch (e) {}

      try {
        const member = await ctx.api.getChatMember('@' + uname, userId);
        if (['left', 'kicked'].includes(member.status)) {
          notJoined.push(ch);
        }
      } catch (err) {
        // Agar bot kanalda admin bo'lmasa, foydalanuvchini bloklamaymiz
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
  let text = `⚠️ <b>Videoni ko'rish uchun quyidagi kanallarga a'zo bo'ling:</b>\n\n`;
  const kb = new InlineKeyboard();

  (notJoinedChannels || []).forEach((ch, idx) => {
    const title = ch.title || `${idx + 1}-Kanal`;
    const link = getChannelLink(ch);
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
  db.trackMovieView(code, ctx.from?.id);

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
  if (!botToken) return false;

  // Agar mavjud bot bo'lsa, to'xtatamiz
  if (botInstance) {
    try {
      await botInstance.stop();
    } catch (e) {}
    botInstance = null;
    isBotRunning = false;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    botInstance = new Bot(botToken);

    // Xatoliklarni ushlab qolish — bot to'xtab qolmasligi uchun
    botInstance.catch((err) => {
      console.error('Adult Grammy error:', err.message || err);
    });

    // Global User Registration & Activity Tracking
    botInstance.use(async (ctx, next) => {
      if (ctx.from) {
        db.addUser(ctx.from);
        db.trackActiveUser(ctx.from.id);
      }
      return next();
    });

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

    // 2. Foydalanuvchi asosiy menyu tugmalari
    botInstance.hears(['🔍 Video Qidirish', '/search'], async (ctx) => {
      await ctx.reply('🔍 <b>Video kodini yoki nomini yuboring:</b>\n\n<i>Masalan: 27 yoki video nomi</i>', { parse_mode: 'HTML' });
    });

    botInstance.hears(['📂 Janrlar', '/janrlar'], async (ctx) => {
      const genres = db.getGenres() || [];
      const kb = new InlineKeyboard();
      genres.forEach((g, idx) => {
        kb.text(g, `genre:${g}`);
        if ((idx + 1) % 2 === 0) kb.row();
      });
      await ctx.reply('📂 <b>Kerakli janrni tanlang:</b>', { parse_mode: 'HTML', reply_markup: kb });
    });

    botInstance.hears(['🔥 Top Videolar', '/top'], async (ctx) => {
      const movies = db.getMovies() || [];
      const topMovies = [...movies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
      if (topMovies.length === 0) {
        return await ctx.reply('Hozircha videolar mavjud emas.');
      }
      let text = `🔥 <b>Eng ko'p ko'rilgan 18+ videolar:</b>\n\n`;
      const kb = new InlineKeyboard();
      topMovies.forEach((m, i) => {
        text += `${i + 1}. <b>${escapeHTML(m.title)}</b> (👁 ${m.views || 0} ko'rish | Kod: <code>${m.code}</code>)\n`;
        kb.text(`🎬 ${m.title.substring(0, 20)}`, `get_movie:${m.code}`);
        if ((i + 1) % 2 === 0) kb.row();
      });
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    });

    botInstance.hears(['❓ Yordam', '/help'], async (ctx) => {
      const helpText =
        `❓ <b>Qanday qilib videolarni ko'rish mumkin?</b>\n\n` +
        `1️⃣ Videoning <b>KODINI</b> botga yuboring (Masalan: <code>27</code>)\n` +
        `2️⃣ Yoki video nomini yozib qidiring\n` +
        `3️⃣ Bot sizga videoni darhol yuboradi!\n\n` +
        `<i>Taklif va murojaatlar uchun admin bilan bog'laning.</i>`;
      await ctx.reply(helpText, { parse_mode: 'HTML' });
    });

    // 3. Start buyrug'i
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
          return await sendSponsorGate(ctx, sub.channels, args);
        }
        const movie = db.findMovieByCode(args);
        if (movie) return await sendMovie(ctx, movie);
      }

      await ctx.reply(i18n.t(userLang, 'welcome', { name: escapeHTML(ctx.from.first_name) }), {
        parse_mode: 'HTML',
        reply_markup: isAdmin(userId) ? getSingleBoshqaruvKeyboard() : getUserKeyboard()
      });
    });

    // 4. Callback Queries
    // Movie tanlash callback
    botInstance.callbackQuery(/^get_movie:(.+)$/, async (ctx) => {
      const code = ctx.match[1];
      await ctx.answerCallbackQuery();
      const sub = await checkSponsorSubscription(ctx, ctx.from.id);
      if (!sub.ok) {
        return await sendSponsorGate(ctx, sub.channels, code);
      }
      const movie = db.findMovieByCode(code);
      if (movie) await sendMovie(ctx, movie);
    });

    // Janr bo'yicha videolar callback
    botInstance.callbackQuery(/^genre:(.+)$/, async (ctx) => {
      const genre = ctx.match[1];
      await ctx.answerCallbackQuery();
      const movies = (db.getMovies() || []).filter(m => (m.genre || '').toLowerCase().includes(genre.toLowerCase()));
      if (movies.length === 0) {
        return await ctx.reply(`«${escapeHTML(genre)}» janrida hozircha videolar yo'q.`);
      }
      let text = `📂 <b>«${escapeHTML(genre)}» janridagi videolar:</b>\n\n`;
      const kb = new InlineKeyboard();
      movies.slice(0, 10).forEach((m, i) => {
        text += `${i + 1}. <b>${escapeHTML(m.title)}</b> (Kod: <code>${m.code}</code>)\n`;
        kb.text(`🎬 ${m.title.substring(0, 20)}`, `get_movie:${m.code}`);
        if ((i + 1) % 2 === 0) kb.row();
      });
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    });

    // Likes & Dislikes Callbacks
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
        try {
          const sm = require(path.resolve(__dirname, '../server/sponsorManager'));
          const channels = db.getChannels();
          channels.forEach(ch => {
            const uname = extractChannelUsername(ch.username);
            if (uname && sm && typeof sm.recordMemberJoin === 'function') {
              sm.recordMemberJoin('@' + uname, ctx.from.id);
            }
          });
        } catch (e) {}

        await ctx.answerCallbackQuery({ text: 'Tasdiqlandi! ✅' });
        try { await ctx.deleteMessage(); } catch (e) {}
        if (code && code !== 'home') {
          const movie = db.findMovieByCode(code);
          if (movie) return await sendMovie(ctx, movie);
        }
        await ctx.reply('✅ Obuna tasdiqlandi. Video kodini yuboring:', {
          reply_markup: isAdmin(ctx.from.id) ? getSingleBoshqaruvKeyboard() : getUserKeyboard()
        });
      } else {
        await ctx.answerCallbackQuery({ text: 'Kanalga a\'zo bo\'lmadingiz! ❌', show_alert: true });
      }
    });

    // 5. Video qo'shish jarayoni (Admin uchun)
    botInstance.on(['message:video', 'message:document'], async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const video = ctx.message.video || (ctx.message.document && ctx.message.document.mime_type?.startsWith('video/') ? ctx.message.document : null);
      if (!video) return;

      userPendingActions.set(ctx.from.id, {
        action: 'waiting_for_code',
        fileId: video.file_id,
        caption: ctx.message.caption || ''
      });
      await ctx.reply('📹 <b>Video qabul qilindi. Ushbu video uchun KOD yuboring:</b>\n\n<i>(Masalan: 28)</i>', { parse_mode: 'HTML' });
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
          await ctx.reply('✅ <b>Kanalga muvaffaqiyatli joylandi!</b>', {
            parse_mode: 'HTML',
            reply_markup: getSingleBoshqaruvKeyboard()
          });
        }
      }
    });

    // 6. Matnli xabarlar va Kodlar
    botInstance.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) {
        // Start, help, search buyruqlari alohida handlerda
        return;
      }

      // Admin kod kiritayotgan bo'lsa
      const pending = userPendingActions.get(ctx.from.id);
      if (isAdmin(ctx.from.id) && pending && pending.action === 'waiting_for_code') {
        userPendingActions.set(ctx.from.id, { ...pending, action: 'waiting_for_poster', code: text });
        return await ctx.reply(
          `✅ Kod qabul qilindi: <b>${escapeHTML(text)}</b>\n\n` +
          `🖼 <b>Endi video uchun POSTER (RASM) yuboring:</b>\n` +
          `<i>(Rasm yuborishni xohlamasangiz «O'tkazib yuborish» deb yozing)</i>`,
          { parse_mode: 'HTML' }
        );
      }

      // Admin poster o'tkazib yuborishni tanlasa
      if (isAdmin(ctx.from.id) && pending && pending.action === 'waiting_for_poster' && text.toLowerCase().includes('o\'tkazib')) {
        userPendingActions.delete(ctx.from.id);
        const result = db.addMovie({
          code: pending.code,
          title: `Video #${pending.code}`,
          description: pending.caption,
          fileId: pending.fileId,
          poster: ''
        });
        if (result) {
          await ctx.reply('⚡️ <b>Video rasmisiz saqlandi.</b>', { parse_mode: 'HTML', reply_markup: getSingleBoshqaruvKeyboard() });
          await publishAutoPost(result);
        }
        return;
      }

      // Sponsor check
      const sub = await checkSponsorSubscription(ctx, ctx.from.id);
      if (!sub.ok) {
        return await sendSponsorGate(ctx, sub.channels, text);
      }

      // 1. To'g'ridan-to'g'ri kod bo'yicha qidirish
      let movie = db.findMovieByCode(text);
      if (movie) {
        db.trackSearch(text, ctx.from.id);
        return await sendMovie(ctx, movie);
      }

      // 2. Nomi bo'yicha qidirish
      const searchResults = db.searchMoviesByTitle(text);
      if (searchResults && searchResults.length > 0) {
        db.trackSearch(text, ctx.from.id);
        if (searchResults.length === 1) {
          return await sendMovie(ctx, searchResults[0]);
        }
        let listText = `🔍 <b>«${escapeHTML(text)}» bo'yicha topilgan videolar:</b>\n\n`;
        const kb = new InlineKeyboard();
        searchResults.slice(0, 10).forEach((m, idx) => {
          listText += `${idx + 1}. <b>${escapeHTML(m.title)}</b> (Kod: <code>${m.code}</code>)\n`;
          kb.text(`🎬 ${m.title.substring(0, 25)}`, `get_movie:${m.code}`);
          if ((idx + 1) % 2 === 0) kb.row();
        });
        listText += `\n<i>Kerakli videoni ko'rish uchun quyidagi tugmani bosing yoki kodini yuboring.</i>`;
        return await ctx.reply(listText, { parse_mode: 'HTML', reply_markup: kb });
      }

      // 3. Hech narsa topilmasa
      db.trackSearch(text, ctx.from.id);
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      await ctx.reply(
        `❌ <b>«${escapeHTML(text)}»</b> bo'yicha hech qanday video topilmadi.\n\n` +
        `<i>Iltimos, video kodini to'g'ri kiriting yoki nomi bilan qidirib ko'ring.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: isAdmin(ctx.from.id) ? getSingleBoshqaruvKeyboard() : getUserKeyboard()
        }
      );
    });

    // Pollingni ishga tushirish
    async function launchPolling() {
      if (!botInstance) return;
      try {
        try {
          await botInstance.api.deleteWebhook({ drop_pending_updates: false });
        } catch (e) {}

        isBotRunning = true;
        await botInstance.start({
          allowed_updates: ['message', 'callback_query', 'inline_query', 'chat_member', 'my_chat_member'],
          onStart: (info) => console.log(`Adult Bot @${info.username} faol ishga tushdi.`)
        });
      } catch (err) {
        console.error('Adult Bot polling error:', err.message || err);
        isBotRunning = false;
        if (!botInstance) return;

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (botInstance && !isBotRunning) {
            console.log('Adult Bot qayta ulanmoqda...');
            launchPolling();
          }
        }, 5000);
      }
    }

    launchPolling();
    return true;
  } catch (err) {
    console.error('Adult Bot startBot error:', err.message || err);
    isBotRunning = false;
    botInstance = null;
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
    if (movie.poster) {
      await botInstance.api.sendPhoto(channelId, movie.poster, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await botInstance.api.sendMessage(channelId, caption, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function stopBot() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (botInstance) {
    try {
      await botInstance.stop();
    } catch (e) {}
    botInstance = null;
  }
  isBotRunning = false;
  return true;
}

module.exports = {
  startBot,
  stopBot,
  getBotStatus: () => ({ running: isBotRunning, botUsername: botInstance?.botInfo?.username || 'Instavdeo_bot' }),
  getBotInstance: () => botInstance
};
