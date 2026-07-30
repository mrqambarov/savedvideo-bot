const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const db = require('./db');
const i18n = require('./i18n');
const sponsorManager = require('../server/sponsorManager');
const fs = require('fs');
const path = require('path');

let botInstance = null;
let isBotRunning = false;
let botUsername = '';
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
    const active = sponsorManager.getActiveSponsorChannel();
    if (active) return active;
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
          let referredBy = null;
          const txt = ctx.message && ctx.message.text;
          if (txt && txt.startsWith('/start ')) {
            const payload = txt.split(' ')[1];
            if (payload && payload.startsWith('ref_')) {
              const rid = parseInt(payload.slice(4), 10);
              if (rid && rid !== ctx.from.id) referredBy = rid;
            }
          }
          db.addUser(ctx.from, referredBy);
          db.trackActiveUser(ctx.from.id);
          if (db.isBanned(ctx.from.id)) return; // bloklangan foydalanuvchini e'tiborsiz qoldirish
        }

        // Bypass checks for callback queries checking subscription, start/help commands, or if user is admin
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'chk_sub') {
          return await next();
        }
        if (ctx.message && ctx.message.text && (ctx.message.text.startsWith('/start') || ctx.message.text.startsWith('/help') || ctx.message.text === '🎁 Do\'stlarni taklif qilish' || isAdmin(ctx.from.id))) {
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

      const webAppUrl = process.env.MOVIE_MINI_APP_URL || 'https://movie-client.vercel.app';

      // Keyboard
      const mainKeyboard = new Keyboard()
        .text('🔍 Kino Qidirish').text('🗂 Janrlar')
        .row()
        .text('🔥 TOP kinolar').text('🎲 Tasodifiy')
        .row()
        .text('⭐ Sevimlilarim').text('📅 Kunlik bonus')
        .row()
        .webApp('🍿 Mini App (Kino Veb-Ilova)', webAppUrl)
        .row()
        .text('🤖 AI Kino Tavsiya').text('🎁 Do\'stlarni taklif qilish')
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

        const keyboard = new InlineKeyboard()
          .text('🇺🇿 O\'zbekcha', 'set_lang:uz')
          .text('🇷🇺 Русский', 'set_lang:ru')
          .text('🇬🇧 English', 'set_lang:en');

        await ctx.reply('🌐 **Iltimos, tilni tanlang / Пожалуйста, выберите язык / Please select language:**', {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      });

      // Language Command (/lang)
      botInstance.command('lang', async (ctx) => {
        const keyboard = new InlineKeyboard()
          .text('🇺🇿 O\'zbekcha', 'set_lang:uz')
          .text('🇷🇺 Русский', 'set_lang:ru')
          .text('🇬🇧 English', 'set_lang:en');

        await ctx.reply('🌐 **Tilni tanlang / Select Language / Выберите язык:**', {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
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

      // Admin Dashboard Command (/admin, /panel)
      botInstance.command(['admin', 'panel'], async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
          return ctx.reply('⚠️ **Siz admin emassiz!**\nAdmin huquqlariga ega bo\'lish uchun administratorga murojaat qiling.', { parse_mode: 'Markdown' });
        }

        const advStats = db.getAdvancedStats();
        const requests = db.getRequests();
        const pendingReqs = (requests || []).filter(r => r.status === 'pending');

        const keyboard = new InlineKeyboard()
          .text('📊 Batafsil Analitika', 'adm_stats')
          .text(`📝 Buyurtmalar (${pendingReqs.length})`, 'adm_requests')
          .row()
          .text('🔄 Yangilash', 'adm_refresh');

        await ctx.reply(
          `⚙️ **XIT FILM — ADMIN PANELI**\n\n` +
          `👋 Xush kelibsiz, Admin!\n\n` +
          `📊 **Asosiy ko'rsatkichlar:**\n` +
          `• 👥 Jami foydalanuvchilar: **${advStats.totalUsers}** ta\n` +
          `• 🎬 Jami kinolar: **${advStats.totalMovies}** ta\n` +
          `• 👁 Total ko'rishlar: **${advStats.stats.totalViews || 0}** marta\n` +
          `• 📝 Kutilayotgan buyurtmalar: **${pendingReqs.length}** ta\n` +
          `• ⚡ Bugungi yangi userlar: **${advStats.growth.newUsersToday}** ta\n\n` +
          `👇 **Mavjud buyruqlar:**\n` +
          `• \`/add [kod] [nomi] | [tavsif] | [janr]\` — Videoga reply qilib yangi kino qo'shish\n` +
          `• \`/stats\` — Batafsil analitika va statistika\n` +
          `• \`/requests\` — Foydalanuvchilar kino buyurtmalari\n` +
          `• \`/broadcast [xabar]\` — Barcha foydalanuvchilarga xabar yuborish`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
      });

      // Admin Stats Command (/stats)
      botInstance.command('stats', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const advStats = db.getAdvancedStats();
        const searchAnalytics = db.getSearchAnalytics();

        let replyText =
          `📊 **BATAHSIL STATISTIKA**\n\n` +
          `👥 **Foydalanuvchilar:**\n` +
          `• Jami: **${advStats.totalUsers}**\n` +
          `• Bugun qo'shilgan: **${advStats.growth.newUsersToday}**\n` +
          `• Shu hafta: **${advStats.growth.newUsersWeek}**\n` +
          `• Shu oy: **${advStats.growth.newUsersMonth}**\n\n` +
          `🎬 **Kinolar & Ko'rishlar:**\n` +
          `• Jami kinolar: **${advStats.totalMovies}**\n` +
          `• Jami ko'rishlar: **${advStats.stats.totalViews || 0}**\n` +
          `• Bugungi ko'rishlar: **${advStats.usage.today.movieViews}**\n` +
          `• Bugungi qidiruvlar: **${advStats.usage.today.searches}**\n\n` +
          `🔍 **Top Qidiruvlar:**\n`;

        if (searchAnalytics.top && searchAnalytics.top.length > 0) {
          searchAnalytics.top.slice(0, 5).forEach((item, idx) => {
            replyText += `${idx + 1}. \`${item.query}\` — ${item.count} marta\n`;
          });
        } else {
          replyText += `_Ma'lumot yo'q_\n`;
        }

        const kb = new InlineKeyboard().text('🔄 Yangilash', 'adm_stats');
        await ctx.reply(replyText, { parse_mode: 'Markdown', reply_markup: kb });
      });

      // Admin Requests Command (/requests)
      botInstance.command('requests', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const requests = db.getRequests();
        if (!requests || requests.length === 0) {
          return await ctx.reply('📝 Hozircha kino buyurtmalari yo\'q.');
        }

        const pending = requests.filter(r => r.status === 'pending');
        let text = `📝 **KINO BUYURTMALARI** (Jami: ${requests.length}, Kutilmoqda: ${pending.length}):\n\n`;

        if (pending.length === 0) {
          text += `_Hozircha kutilayotgan buyurtmalar yo'q._`;
        } else {
          pending.slice(-10).reverse().forEach((r, idx) => {
            const userStr = r.username ? `@${r.username}` : `ID: ${r.userId}`;
            text += `${idx + 1}. *${r.title}*\n   👤 Kimdan: ${userStr} | 📅 ${r.createdAt ? r.createdAt.split('T')[0] : ''}\n\n`;
          });
        }

        await ctx.reply(text, { parse_mode: 'Markdown' });
      });

      // Admin Broadcast Command (/broadcast)
      botInstance.command('broadcast', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const broadcastText = ctx.match;
        if (!broadcastText) {
          return await ctx.reply(
            `📢 **Xabar tarqatish formati:**\n\n` +
            `\`/broadcast Sizning xabaringiz\` deb yozing.`,
            { parse_mode: 'Markdown' }
          );
        }

        const users = db.getUsers();
        await ctx.reply(`📢 Xabar ${users.length} ta foydalanuvchiga yuborilmoqda...`);

        let sent = 0, failed = 0;
        for (const user of users) {
          try {
            await botInstance.api.sendMessage(user.id, broadcastText, { parse_mode: 'Markdown' });
            sent++;
          } catch (e) {
            failed++;
          }
          await new Promise(r => setTimeout(r, 40));
        }

        await ctx.reply(`✅ **Xabar yuborish yakunlandi!**\n\n🟢 Yuborildi: ${sent}\n🔴 Xatolik: ${failed}`);
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

        if (state === 'waiting_for_ai_mood') {
          userSession.delete(userId);
          const results = db.recommendMoviesByMood(text);
          if (!results || results.length === 0) {
            return await ctx.reply('🤖 Kechirasiz, sizning so\'rovingiz bo\'yicha kino topilmadi. Boshqa so\'zlar bilan yozib ko\'ring.');
          }

          let replyText = `🤖 **"${text}" so'rovingiz bo'yicha mos keladigan kinolar:**\n\n`;
          const keyboard = new InlineKeyboard();
          results.slice(0, 8).forEach((m, idx) => {
            replyText += `${idx + 1}. *${m.title}* — Kod: \`${m.code}\`\n`;
            keyboard.text(`${idx + 1} 🎬`, `mv:${m.code}`);
            if (idx % 4 === 3) keyboard.row();
          });
          return await ctx.reply(replyText, { parse_mode: 'Markdown', reply_markup: keyboard });
        }

        if (text === '🤖 AI Kino Tavsiya') {
          userSession.set(userId, 'waiting_for_ai_mood');
          return await ctx.reply(
            '🤖 **AI Kino Tavsiya Etuvchi**\n\n' +
            'Bugun qanday kino ko\'rmoqchisiz? Kayfiyatingizni yoki istagingizni yozing:\n\n' +
            '• *Masalan: "Menga kulgili oilaviy komediya topib ber"*\n' +
            '• *Masalan: "Jangari va sarguzasht kino"*\n' +
            '• *Masalan: "Qo\'rqinchli kino"*\n\n' +
            '👇 Matn ko\'rinishida yozib yuboring:',
            { parse_mode: 'Markdown' }
          );
        }

        if (text === '🔍 Kino Qidirish') {
          return await ctx.reply('🔍 Kino nomini kiriting:');
        }

        if (text === '🗂 Janrlar') {
          const keyboard = new InlineKeyboard();
          db.getGenres().forEach((genre, idx) => {
            keyboard.text(genre, `genre:${genre}`);
            if (idx % 2 === 1) keyboard.row();
          });
          return await ctx.reply('🗂 **Janrlardan birini tanlang:**', {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }

        if (text === '🎁 Do\'stlarni taklif qilish') {
          const uname = ctx.me.username;
          const link = `https://t.me/${uname}?start=ref_${ctx.from.id}`;
          const info = db.getReferralInfo(ctx.from.id);
          const board = db.getReferralLeaderboard(5);
          let top = '';
          board.forEach((u, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
            const name = u.username ? '@' + u.username : (u.first_name || 'Foydalanuvchi');
            top += `${medal} ${name} — ${u.refCount} ta\n`;
          });
          const rankLine = info.rank > 0 ? `🏆 Sizning o'rningiz: **${info.rank}**` : `🏆 Hali reytingga kirmadingiz`;
          const msg =
            `🎁 **Do'stlarni taklif qiling va sovg'alar yutib oling!**\n\n` +
            `Havolangizni do'stlaringizga ulashing. Har bir do'st bot orqali kino ko'rsa, sizga hisoblanadi.\n\n` +
            `🔗 Sizning havolangiz:\n\`${link}\`\n\n` +
            `✅ Muvaffaqiyatli takliflar: **${info.refCount}**\n` +
            `⏳ Kutilmoqda (hali kino ko'rmagan): **${info.refPending}**\n` +
            `${rankLine}\n\n` +
            (top ? `🏅 **Eng faol taklif qiluvchilar:**\n${top}` : '');
          const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Bepul kinolar shu botda! 🍿')}`;
          const kb = new InlineKeyboard().url('📤 Do\'stlarga ulashish', shareUrl);
          return await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
        }

        if (text === '🔥 TOP kinolar') {
          const top = db.getTopMovies('views', 10);
          if (!top.length) return await ctx.reply('Hozircha kinolar yo\'q.');
          let msg = '🔥 **Eng ko\'p ko\'rilgan kinolar:**\n\n';
          const kb = new InlineKeyboard();
          top.forEach((m, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
            msg += `${medal} *${m.title}* — 👁 ${m.views || 0} | Kod: \`${m.code}\`\n`;
            kb.text(`${i + 1}`, `mv:${m.code}`);
            if (i % 5 === 4) kb.row();
          });
          return await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
        }

        if (text === '🎲 Tasodifiy') {
          const movie = db.getRandomMovie();
          if (!movie) return await ctx.reply('Hozircha kinolar yo\'q.');
          db.trackMovieView(movie.code);
          return await sendMovie(ctx, movie);
        }

        if (text === '⭐ Sevimlilarim') {
          const favs = db.getFavorites(ctx.from.id);
          if (!favs.length) return await ctx.reply('⭐ Sevimlilaringiz hali bo\'sh.\n\nKino ostidagi "☆ Sevimlilarga" tugmasi orqali qo\'shing.');
          let msg = '⭐ **Sevimli kinolaringiz:**\n\n';
          const kb = new InlineKeyboard();
          favs.forEach((m, i) => {
            msg += `${i + 1}. *${m.title}* — Kod: \`${m.code}\`\n`;
            kb.text(`${i + 1} 🎬`, `mv:${m.code}`);
            if (i % 4 === 3) kb.row();
          });
          return await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
        }

        if (text === '📅 Kunlik bonus') {
          const { streak, alreadyToday } = db.checkIn(ctx.from.id);
          if (alreadyToday) {
            return await ctx.reply(`✅ Bugungi bonusni allaqachon oldingiz!\n\n🔥 Joriy streak: **${streak} kun**\nErtaga yana keling — streakni uzmang!`, { parse_mode: 'Markdown' });
          }
          const milestones = { 3: '🎬 3 kunlik streak!', 7: '🏆 7 kun ketma-ket, zo\'r!', 14: '💎 14 kun!', 30: '👑 30 kun — afsona!' };
          const bonus = milestones[streak] ? `\n\n${milestones[streak]}` : '';
          return await ctx.reply(`🎁 **Kunlik bonus olindi!**\n\n🔥 Streak: **${streak} kun** ketma-ket\n\nHar kuni kelib streakni oshiring!${bonus}`, { parse_mode: 'Markdown' });
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
        db.trackSearchQuery(text, results ? results.length : 0);
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

        // Admin Callback Queries
        if (data.startsWith('adm_')) {
          if (!isAdmin(ctx.from.id)) {
            return await ctx.answerCallbackQuery({ text: '⚠️ Siz admin emassiz!', show_alert: true });
          }

          if (data === 'adm_stats') {
            const advStats = db.getAdvancedStats();
            const searchAnalytics = db.getSearchAnalytics();
            let text =
              `📊 **BATAHSIL STATISTIKA**\n\n` +
              `👥 **Foydalanuvchilar:**\n` +
              `• Jami: **${advStats.totalUsers}**\n` +
              `• Bugun qo'shilgan: **${advStats.growth.newUsersToday}**\n` +
              `• Shu hafta: **${advStats.growth.newUsersWeek}**\n` +
              `• Shu oy: **${advStats.growth.newUsersMonth}**\n\n` +
              `🎬 **Kinolar & Ko'rishlar:**\n` +
              `• Jami kinolar: **${advStats.totalMovies}**\n` +
              `• Jami ko'rishlar: **${advStats.stats.totalViews || 0}**\n` +
              `• Bugungi ko'rishlar: **${advStats.usage.today.movieViews}**\n` +
              `• Bugungi qidiruvlar: **${advStats.usage.today.searches}**\n\n` +
              `🔍 **Top Qidiruvlar:**\n`;

            if (searchAnalytics.top && searchAnalytics.top.length > 0) {
              searchAnalytics.top.slice(0, 5).forEach((item, idx) => {
                text += `${idx + 1}. \`${item.query}\` — ${item.count} marta\n`;
              });
            } else {
              text += `_Ma'lumot yo'q_\n`;
            }

            const kb = new InlineKeyboard()
              .text('🔙 Orqaga', 'adm_refresh')
              .text('🔄 Yangilash', 'adm_stats');

            try {
              await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
            } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Statistika yangilandi' }).catch(() => {});
            return;
          }

          if (data === 'adm_requests') {
            const requests = db.getRequests();
            const pending = (requests || []).filter(r => r.status === 'pending');
            let text = `📝 **KINO BUYURTMALARI** (Jami: ${requests ? requests.length : 0}, Kutilmoqda: ${pending.length}):\n\n`;

            if (pending.length === 0) {
              text += `_Hozircha kutilayotgan buyurtmalar yo'q._`;
            } else {
              pending.slice(-10).reverse().forEach((r, idx) => {
                const userStr = r.username ? `@${r.username}` : `ID: ${r.userId}`;
                text += `${idx + 1}. *${r.title}*\n   👤 Kimdan: ${userStr} | 📅 ${r.createdAt ? r.createdAt.split('T')[0] : ''}\n\n`;
              });
            }

            const kb = new InlineKeyboard()
              .text('🔙 Orqaga', 'adm_refresh')
              .text('🔄 Yangilash', 'adm_requests');

            try {
              await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
            } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Buyurtmalar yangilandi' }).catch(() => {});
            return;
          }

          if (data === 'adm_refresh') {
            const advStats = db.getAdvancedStats();
            const requests = db.getRequests();
            const pendingReqs = (requests || []).filter(r => r.status === 'pending');

            const keyboard = new InlineKeyboard()
              .text('📊 Batafsil Analitika', 'adm_stats')
              .text(`📝 Buyurtmalar (${pendingReqs.length})`, 'adm_requests')
              .row()
              .text('🔄 Yangilash', 'adm_refresh');

            const text =
              `⚙️ **XIT FILM — ADMIN PANELI**\n\n` +
              `👋 Xush kelibsiz, Admin!\n\n` +
              `📊 **Asosiy ko'rsatkichlar:**\n` +
              `• 👥 Jami foydalanuvchilar: **${advStats.totalUsers}** ta\n` +
              `• 🎬 Jami kinolar: **${advStats.totalMovies}** ta\n` +
              `• 👁 Total ko'rishlar: **${advStats.stats.totalViews || 0}** marta\n` +
              `• 📝 Kutilayotgan buyurtmalar: **${pendingReqs.length}** ta\n` +
              `• ⚡ Bugungi yangi userlar: **${advStats.growth.newUsersToday}** ta\n\n` +
              `👇 **Mavjud buyruqlar:**\n` +
              `• \`/add [kod] [nomi] | [tavsif] | [janr]\` — Videoga reply qilib yangi kino qo'shish\n` +
              `• \`/stats\` — Batafsil analitika va statistika\n` +
              `• \`/requests\` — Foydalanuvchilar kino buyurtmalari\n` +
              `• \`/broadcast [xabar]\` — Barcha foydalanuvchilarga xabar yuborish`;

            try {
              await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
            } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Admin paneli yangilandi' }).catch(() => {});
            return;
          }
        }

        if (data.startsWith('set_lang:')) {
          const langCode = data.split(':')[1];
          db.setUserLang(ctx.from.id, langCode);

          const confirmText = {
            uz: '✅ Til O\'zbekchaga o\'zgartirildi!',
            ru: '✅ Язык успешно изменен на Русский!',
            en: '✅ Language successfully set to English!'
          }[langCode] || '✅ Til o\'zgartirildi!';

          await ctx.answerCallbackQuery({ text: confirmText, show_alert: true }).catch(() => {});
          try { await ctx.editMessageText(confirmText); } catch (e) {}

          const name = ctx.from.first_name || 'foydalanuvchi';
          let welcomeMsg = i18n.t(langCode, 'welcome', { name });
          if (isAdmin(ctx.from.id)) {
            welcomeMsg += i18n.t(langCode, 'admin_help');
          }

          const userKb = new Keyboard()
            .text(i18n.t(langCode, 'search_btn'))
            .text(i18n.t(langCode, 'genre_btn'))
            .row()
            .text(i18n.t(langCode, 'req_btn'))
            .text(i18n.t(langCode, 'help_btn'))
            .resized();

          await ctx.reply(welcomeMsg, { parse_mode: 'Markdown', reply_markup: userKb });
          return;
        }

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
              sponsorManager.recordMemberJoin(activeChannel.username, ctx.from.id);
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

        // Favorite toggle Callback
        if (data.startsWith('fav:')) {
          const code = data.split(':')[1];
          const { favorited } = db.toggleFavorite(ctx.from.id, code);
          const movie = db.getMovieByCode(code);
          const likesCount = movie && movie.likes ? movie.likes.length : 0;
          const dislikesCount = movie && movie.dislikes ? movie.dislikes.length : 0;
          const keyboard = new InlineKeyboard()
            .text(`👍 ${likesCount}`, `like:${code}`)
            .text(`👎 ${dislikesCount}`, `dislike:${code}`)
            .row()
            .text(favorited ? '⭐ Sevimlilarda' : '☆ Sevimlilarga', `fav:${code}`);
          try { await ctx.editMessageReplyMarkup({ reply_markup: keyboard }); } catch (e) {}
          await ctx.answerCallbackQuery({ text: favorited ? "⭐ Sevimlilarga qo'shildi" : "Sevimlilardan olindi" }).catch(() => {});
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
        onStart: async (botInfo) => {
          botUsername = botInfo.username;
          console.log(`Movie Telegram Bot @${botInfo.username} started successfully.`);
          try {
            const webAppUrl = process.env.MOVIE_MINI_APP_URL || 'https://movie-client.vercel.app';
            await botInstance.api.setChatMenuButton({
              menu_button: {
                type: 'web_app',
                text: '🍿 Kinolar App',
                web_app: { url: webAppUrl }
              }
            }).catch(() => {});
          } catch (e) {}
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
  // Watching a movie is the qualifying action for the inviter's referral.
  if (ctx.from) {
    const q = db.qualifyReferral(ctx.from.id);
    if (q && q.qualified && q.referrerId) {
      const tier = db.claimTierFor(q.referrerId, q.refCount);
      if (tier) {
        try {
          await ctx.api.sendMessage(q.referrerId,
            `🎉 **Tabriklaymiz!** Siz **${tier.count} ta** do'st taklif qildingiz va mukofotga ega bo'ldingiz:\n\n🎁 ${tier.reward}`,
            { parse_mode: 'Markdown' });
        } catch (e) {}
      }
    }
  }
  const likesCount = movie.likes ? movie.likes.length : 0;
  const dislikesCount = movie.dislikes ? movie.dislikes.length : 0;
  const downloaderBotUsername = process.env.DOWNLOADER_BOT_USERNAME || 'savemedia_music_bot';
  const captionText = `🎬 **${movie.title}**\n\n` +
    `🗂 Janr: #${movie.genre ? movie.genre.replace(/\s+/g, '_') : 'Tarjima_kino'}\n` +
    `🔑 Kod: \`${movie.code}\`\n\n` +
    `📝 _${movie.description || 'Tavsif berilmagan'}_\n\n` +
    `📹 YouTube, Instagram, TikTokdan yuklab olish: @${downloaderBotUsername}`;

  const fav = ctx.from ? db.isFavorite(ctx.from.id, movie.code) : false;
  const keyboard = new InlineKeyboard()
    .text(`👍 ${likesCount}`, `like:${movie.code}`)
    .text(`👎 ${dislikesCount}`, `dislike:${movie.code}`)
    .row()
    .text(fav ? '⭐ Sevimlilarda' : '☆ Sevimlilarga', `fav:${movie.code}`);

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

// Announce a newly added movie to every user (fire-and-forget; throttled).
async function notifyNewMovie(movie) {
  if (!isBotRunning || !botInstance) return { sent: 0, failed: 0 };
  const users = db.getUsers();
  const caption =
    `🆕 **Yangi kino qo'shildi!**\n\n` +
    `🎬 *${movie.title}*\n` +
    `🗂 ${movie.genre || 'Tarjima kino'}\n` +
    `🔑 Kod: \`${movie.code}\`\n\n` +
    `Ko'rish uchun shu kodni yuboring: \`${movie.code}\``;
  let sent = 0, failed = 0;
  for (const u of users) {
    try {
      if (movie.poster) {
        await botInstance.api.sendPhoto(u.id, movie.poster, { caption, parse_mode: 'Markdown' });
      } else {
        await botInstance.api.sendMessage(u.id, caption, { parse_mode: 'Markdown' });
      }
      sent++;
    } catch (e) {
      failed++;
    }
    await new Promise(r => setTimeout(r, 40));
  }
  console.log(`New movie notification for ${movie.code}: sent ${sent}, failed ${failed}`);
  return { sent, failed };
}

module.exports = {
  startBot,
  stopBot,
  getBotStatus,
  getBotInstance,
  getBotUsername,
  notifyNewMovie
};
