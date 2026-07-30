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

      // Helper for Visual Progress Bar
      function makeProgressBar(value, total, length = 10) {
        if (!total || total <= 0) return '░'.repeat(length) + ' 0%';
        const ratio = Math.min(Math.max(value / total, 0), 1);
        const filledCount = Math.round(ratio * length);
        const emptyCount = length - filledCount;
        const percent = Math.round(ratio * 100);
        return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`;
      }

      function buildAdminDashboardMessage() {
        const advStats = db.getAdvancedStats();
        const requests = db.getRequests();
        const pendingReqs = (requests || []).filter(r => r.status === 'pending');
        const uptimeHours = (process.uptime() / 3600).toFixed(1);
        const memMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
        const webAppUrl = process.env.MOVIE_MINI_APP_URL || 'https://movie-client.vercel.app';

        const text =
          `👑 **XIT FILM — ENTERPRISE ADMIN DASHBOARD**\n` +
          `═════════════════════════\n` +
          `🟢 **Server:** Online  |  ⏱ **Uptime:** ${uptimeHours} soat  |  💾 **RAM:** ${memMb} MB\n\n` +
          `📊 **ASOSIY MONITORING:**\n` +
          ` ┣ 👥 Jami foydalanuvchilar: **${advStats.totalUsers.toLocaleString()}** ta\n` +
          ` ┣ 🎬 Jami kinolar bazasi: **${advStats.totalMovies.toLocaleString()}** ta\n` +
          ` ┣ 👁 Total ko'rishlar: **${(advStats.stats.totalViews || 0).toLocaleString()}** marta\n` +
          ` ┣ 📝 Kutilayotgan buyurtmalar: **${pendingReqs.length}** ta\n` +
          ` ┗ ⚡ Bugungi yangi userlar: **+${advStats.growth.newUsersToday}** ta\n\n` +
          `⚙️ **ADMIN BUYRUQLARI:**\n` +
          `• \`/add [kod] [nomi] | [tavsif] | [janr]\` — Videoga reply qilib kino qo'shish\n` +
          `• \`/del [kod]\` — Kinoni bazadan o'chirish\n` +
          `• \`/user [id/@username]\` — Foydalanuvchi ma'lumotlari\n` +
          `• \`/ban [id]\` / \`/unban [id]\` — Qoidabuzarlarni bloklash\n` +
          `• \`/broadcast [xabar]\` — Barcha foydalanuvchilarga e'lon\n\n` +
          `👇 *Bo'limni tanlash uchun quyidagi tugmalarni bosing:*`;

        const keyboard = new InlineKeyboard()
          .text('📊 Analitika & Grafik', 'adm_stats')
          .text(`📝 Buyurtmalar (${pendingReqs.length})`, 'adm_requests')
          .row()
          .text('🎬 Kinolar Top-5', 'adm_movies')
          .text('👤 Foydalanuvchilar', 'adm_users')
          .row()
          .url('🍿 Web Admin Panel', webAppUrl)
          .text('🔄 Yangilash', 'adm_refresh');

        return { text, keyboard };
      }

      function buildAdminStatsMessage() {
        const advStats = db.getAdvancedStats();
        const searchAnalytics = db.getSearchAnalytics();
        const todayViews = advStats.usage.today.movieViews || 0;
        const todaySearches = advStats.usage.today.searches || 0;

        let text =
          `📈 **BATAHSIL ANALITIKA VA STATISTIKA**\n` +
          `═════════════════════════\n\n` +
          `👥 **FOYDALANUVCHILAR O'SISHI:**\n` +
          ` ┣ Bugun: **+${advStats.growth.newUsersToday}** ta\n` +
          ` ┣ Shu hafta: **+${advStats.growth.newUsersWeek}** ta\n` +
          ` ┗ Shu oy: **+${advStats.growth.newUsersMonth}** ta\n\n` +
          `🎯 **AKTIVLIK KO'RSATKICHLARI:**\n` +
          ` ┣ Bugungi ko'rishlar: **${todayViews}** marta\n` +
          ` ┣ Bugungi qidiruvlar: **${todaySearches}** marta\n` +
          ` ┗ Oylik aktiv userlar: **${advStats.active.month}** ta\n\n` +
          `📊 **TOP QIDIRUVLAR (PROGRESS BAR):**\n`;

        if (searchAnalytics.top && searchAnalytics.top.length > 0) {
          const maxCount = searchAnalytics.top[0].count || 1;
          searchAnalytics.top.slice(0, 5).forEach((item, idx) => {
            const bar = makeProgressBar(item.count, maxCount, 8);
            text += `${idx + 1}. \`${item.query}\` (${item.count} marta)\n   ${bar}\n`;
          });
        } else {
          text += `_Hozircha qidiruv statistikasi mavjud emas_\n`;
        }

        const keyboard = new InlineKeyboard()
          .text('🔙 Asosiy Menyu', 'adm_home')
          .text('🔄 Yangilash', 'adm_stats');

        return { text, keyboard };
      }

      function buildAdminMoviesMessage() {
        const movies = db.getMovies();
        const topMovies = db.getTopMovies(5);

        let text =
          `🎬 **KINOLAR BAZASI VA TOP FILMLAR**\n` +
          `═════════════════════════\n` +
          `📦 Bazadagi jami kinolar: **${movies.length}** ta\n\n` +
          `🔥 **ENG KO'P KO'RILGAN TOP-5 FILMLAR:**\n\n`;

        if (topMovies && topMovies.length > 0) {
          topMovies.forEach((m, idx) => {
            text += `${idx + 1}. *${m.title}*\n   🔑 Kod: \`${m.code}\` | 👁 Ko'rishlar: **${m.views || 0}** | 🗂 ${m.genre || 'Tarjima'}\n\n`;
          });
        } else {
          text += `_Hozircha kinolar mavjud emas_\n\n`;
        }

        text +=
          `💡 **Boshqaruv maslahati:**\n` +
          `• Yangi kino qo'shish: Videoga reply qilib \`/add [kod] [nomi] | [tavsif] | [janr]\` yozing.\n` +
          `• Kinoni o'chirish: \`/del [kod]\` buyrug'ini yuboring.`;

        const keyboard = new InlineKeyboard()
          .text('🔙 Asosiy Menyu', 'adm_home')
          .text('🔄 Yangilash', 'adm_movies');

        return { text, keyboard };
      }

      function buildAdminRequestsMessage() {
        const requests = db.getRequests();
        const pending = (requests || []).filter(r => r.status === 'pending');

        let text =
          `📝 **KINO BUYURTMALARI BOSHQARUVI**\n` +
          `═════════════════════════\n` +
          `📊 Jami buyurtmalar: **${requests ? requests.length : 0}** | ⏳ Kutilmoqda: **${pending.length}**\n\n`;

        const keyboard = new InlineKeyboard();

        if (pending.length === 0) {
          text += `✅ *Barcha buyurtmalar bajarilgan! Kutilayotgan so'rovlar yo'q.*\n`;
        } else {
          pending.slice(-5).reverse().forEach((r, idx) => {
            const userStr = r.username ? `@${r.username}` : `ID: \`${r.userId}\``;
            text += `${idx + 1}. 🎬 *${r.title}*\n   👤 Kimdan: ${userStr} | 🆔 ID: \`${r.id}\`\n\n`;
            keyboard.text(`✅ Bajarildi #${r.id}`, `req_done:${r.id}`).text(`🗑 O'chirish #${r.id}`, `req_del:${r.id}`).row();
          });
        }

        keyboard.text('🔙 Asosiy Menyu', 'adm_home').text('🔄 Yangilash', 'adm_requests');

        return { text, keyboard };
      }

      function buildAdminUsersMessage() {
        const users = db.getUsers();
        const bannedCount = users.filter(u => db.isBanned(u.id)).length;

        let text =
          `👤 **FOYDALANUVCHILAR BOSHQARUVI**\n` +
          `═════════════════════════\n` +
          `👥 Jami foydalanuvchilar: **${users.length}** ta\n` +
          `🚫 Bloklanganlar: **${bannedCount}** ta\n\n` +
          `🛠 **Boshqaruv buyruqlari:**\n` +
          `• \`/user [id yoki @username]\` — Foydalanuvchi profilini ko'rish\n` +
          `• \`/ban [id]\` — Foydalanuvchini bloklash\n` +
          `• \`/unban [id]\` — Blokdan chiqarish\n` +
          `• \`/broadcast [xabar]\` — Barcha foydalanuvchilarga xabar yuborish`;

        const keyboard = new InlineKeyboard()
          .text('🔙 Asosiy Menyu', 'adm_home')
          .text('🔄 Yangilash', 'adm_users');

        return { text, keyboard };
      }

      // Admin Dashboard Command (/admin, /panel)
      botInstance.command(['admin', 'panel'], async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
          return ctx.reply('⚠️ **Siz admin emassiz!**\nAdmin huquqlariga ega bo\'lish uchun administratorga murojaat qiling.', { parse_mode: 'Markdown' });
        }
        const { text, keyboard } = buildAdminDashboardMessage();
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      });

      // Admin Stats Command (/stats)
      botInstance.command('stats', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const { text, keyboard } = buildAdminStatsMessage();
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      });

      // Admin Requests Command (/requests)
      botInstance.command('requests', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const { text, keyboard } = buildAdminRequestsMessage();
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      });

      // Admin Delete Movie Command (/del)
      botInstance.command('del', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const code = ctx.match ? ctx.match.trim() : '';
        if (!code) {
          return await ctx.reply('⚠️ **Formati:** `/del [kino_kodi]`', { parse_mode: 'Markdown' });
        }
        const res = db.deleteMovie(code);
        if (res) {
          await ctx.reply(`✅ **Kino bazadan o'chirildi!**\n\n🔑 Kod: \`${code}\``, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(`❌ **Xatolik:** \`${code}\` kodli kino topilmadi.`, { parse_mode: 'Markdown' });
        }
      });

      // Admin User Info Command (/user)
      botInstance.command('user', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const query = ctx.match ? ctx.match.trim() : '';
        if (!query) {
          return await ctx.reply('⚠️ **Formati:** `/user [ID yoki @username]`', { parse_mode: 'Markdown' });
        }
        const users = db.getUsers();
        const cleanQ = query.replace('@', '').toLowerCase();
        const target = users.find(u => String(u.id) === cleanQ || (u.username && u.username.toLowerCase() === cleanQ));

        if (!target) {
          return await ctx.reply(`❌ Foydalanuvchi **"${query}"** topilmadi.`, { parse_mode: 'Markdown' });
        }

        const favs = db.getFavorites(target.id);
        const refInfo = db.getReferralInfo(target.id);
        const bannedStr = db.isBanned(target.id) ? '🔴 BLOKLANGAN (Banned)' : '🟢 FAOL (Active)';

        const text =
          `👤 **FOYDALANUVCHl MA'LUMOTLARI**\n` +
          `═════════════════════════\n` +
          `🆔 Telegram ID: \`${target.id}\`\n` +
          `👤 Ism: **${target.first_name || 'Noma\'lum'}**\n` +
          `🌐 Username: ${target.username ? '@' + target.username : '_Mavjud emas_'}\n` +
          `🌐 Til: \`${target.lang || 'uz'}\`\n` +
          `📅 Qo'shilgan: \`${target.dateJoined ? target.dateJoined.split('T')[0] : 'Noma\'lum'}\`\n` +
          `⭐ Sevimlilar: **${favs ? favs.length : 0}** ta kino\n` +
          `🎁 Taklif qilganlar: **${refInfo.refCount || 0}** ta user\n` +
          `🛡 Status: **${bannedStr}**`;

        await ctx.reply(text, { parse_mode: 'Markdown' });
      });

      // Admin Ban & Unban Commands (/ban, /unban)
      botInstance.command('ban', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const targetId = ctx.match ? ctx.match.trim() : '';
        if (!targetId || isNaN(Number(targetId))) {
          return await ctx.reply('⚠️ **Formati:** `/ban [Telegram_ID]`', { parse_mode: 'Markdown' });
        }
        db.setBanned(Number(targetId), true);
        await ctx.reply(`🔴 **Foydalanuvchi [${targetId}] bloklandi!**`, { parse_mode: 'Markdown' });
      });

      botInstance.command('unban', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const targetId = ctx.match ? ctx.match.trim() : '';
        if (!targetId || isNaN(Number(targetId))) {
          return await ctx.reply('⚠️ **Formati:** `/unban [Telegram_ID]`', { parse_mode: 'Markdown' });
        }
        db.setBanned(Number(targetId), false);
        await ctx.reply(`🟢 **Foydalanuvchi [${targetId}] blokdan chiqarildi!**`, { parse_mode: 'Markdown' });
      });

      // Admin Broadcast Command (/broadcast, /broadcast_pin)
      botInstance.command(['broadcast', 'broadcast_pin'], async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const isPin = ctx.message.text.startsWith('/broadcast_pin');
        const broadcastText = ctx.match ? ctx.match.trim() : '';

        if (!broadcastText) {
          return await ctx.reply(
            `📢 **PROFESSIONAL E'LON TARQATUVCHI**\n\n` +
            `• Oddiy e'lon: \`/broadcast [Xabaringiz]\`\n` +
            `• Sanchilgan (Pin) e'lon: \`/broadcast_pin [Xabaringiz]\``,
            { parse_mode: 'Markdown' }
          );
        }

        const users = db.getUsers();
        await ctx.reply(`📢 Xabar **${users.length}** ta foydalanuvchiga yuborilmoqda...`, { parse_mode: 'Markdown' });

        let sent = 0, failed = 0;
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          try {
            const m = await botInstance.api.sendMessage(u.id, broadcastText, { parse_mode: 'Markdown' });
            if (isPin) {
              await botInstance.api.pinChatMessage(u.id, m.message_id).catch(() => {});
            }
            sent++;
          } catch (e) {
            failed++;
          }
          await new Promise(r => setTimeout(r, 40));
        }

        await ctx.reply(
          `✅ **E'LON TARQATISH YAKUNLANDI!**\n\n` +
          `🟢 Muvaffaqiyatli: **${sent}** ta\n` +
          `🔴 Yetib bormadi: **${failed}** ta`,
          { parse_mode: 'Markdown' }
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

        // Handle slash commands in message:text handler
        if (text.startsWith('/')) {
          if (!text.startsWith('/add ') || !isAdmin(ctx.from.id)) {
            return;
          }
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
        if (data.startsWith('adm_') || data.startsWith('req_done:') || data.startsWith('req_del:')) {
          if (!isAdmin(ctx.from.id)) {
            return await ctx.answerCallbackQuery({ text: '⚠️ Siz admin emassiz!', show_alert: true });
          }

          if (data === 'adm_home' || data === 'adm_refresh') {
            const { text, keyboard } = buildAdminDashboardMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Admin paneli yangilandi' }).catch(() => {});
            return;
          }

          if (data === 'adm_stats') {
            const { text, keyboard } = buildAdminStatsMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Statistika yangilandi' }).catch(() => {});
            return;
          }

          if (data === 'adm_movies') {
            const { text, keyboard } = buildAdminMoviesMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Kinolar ro\'yxati yangilandi' }).catch(() => {});
            return;
          }

          if (data === 'adm_requests') {
            const { text, keyboard } = buildAdminRequestsMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Buyurtmalar yangilandi' }).catch(() => {});
            return;
          }

          if (data === 'adm_users') {
            const { text, keyboard } = buildAdminUsersMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
            await ctx.answerCallbackQuery({ text: 'Userlar bo\'limi' }).catch(() => {});
            return;
          }

          if (data.startsWith('req_done:')) {
            const reqId = data.split(':')[1];
            const requests = db.getRequests();
            const targetReq = requests ? requests.find(r => String(r.id) === String(reqId)) : null;

            db.completeRequest(reqId);

            if (targetReq && targetReq.userId) {
              try {
                await botInstance.api.sendMessage(
                  targetReq.userId,
                  `🎉 **Tabriklaymiz!** Siz so'ragan *"${targetReq.title}"* filmi bazamizga qo'shildi!\n\n🍿 Kodini kiriting va tomosha qiling!`,
                  { parse_mode: 'Markdown' }
                );
              } catch (e) {}
            }

            await ctx.answerCallbackQuery({ text: '✅ Buyurtma bajarildi va foydalanuvchiga xabar berildi!', show_alert: true }).catch(() => {});
            const { text, keyboard } = buildAdminRequestsMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
            return;
          }

          if (data.startsWith('req_del:')) {
            const reqId = data.split(':')[1];
            db.deleteRequest(reqId);
            await ctx.answerCallbackQuery({ text: '🗑 Buyurtma o\'chirildi', show_alert: true }).catch(() => {});
            const { text, keyboard } = buildAdminRequestsMessage();
            try { await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
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
