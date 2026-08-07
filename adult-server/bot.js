const { Bot, InputFile, InlineKeyboard, Keyboard } = require('grammy');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require('./db');
const i18n = require('./i18n');

let botInstance = null;
let isBotRunning = false;
let pendingBroadcastMessage = null;

const userPendingActions = new Map();

function sanitizeUtf8(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '')
    .trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanAdText(text) {
  if (!text) return '';
  let str = String(text);
  const lines = str.split('\n');
  const cleanLines = [];

  for (let line of lines) {
    let l = line.trim();
    if (!l) continue;
    if (l.includes('@') || l.includes('http://') || l.includes('https://') || l.includes('t.me/')) continue;
    if (/orqali|tomosha|bepul|kodlarni|yuklab|obuna|kanali/i.test(l)) continue;

    l = l.replace(/^📦?\s*(?:nomi|title|kino nomi|kino)[\s:-]*/gi, '');
    l = l.replace(/^🔑?\s*(?:kodi|kod|code|kino kodi)[\s:-]*/gi, '');
    l = l.replace(/^🗂?\s*(?:janri|janr|genre)[\s:-]*/gi, '');
    l = l.replace(/^[\s🎬🍿🔥⚡️📌👉📦-]+/u, '').trim();

    if (l.length > 0) {
      cleanLines.push(l);
    }
  }

  return sanitizeUtf8(cleanLines.join('\n')).trim();
}

function extractCleanTitle(str) {
  if (!str) return '';
  let clean = String(str);
  clean = clean.replace(/^(?:kino|film|serial|kodi|kod|nomi)[\s:-]*/gi, '');
  clean = clean.replace(/S\d+[\s._-]*E\d+/gi, '');
  clean = clean.replace(/\d+[\s-]*(?:mavsum|sezon|season|fasl)/gi, '');
  clean = clean.replace(/(?:mavsum|sezon|season|fasl)[\s:-]*\d+/gi, '');
  clean = clean.replace(/\d+[\s-]*(?:qism|epizod|ep|episode)/gi, '');
  clean = clean.replace(/(?:qism|epizod|ep|episode)[\s:-]*\d+/gi, '');
  clean = clean.replace(/\(?o['`’]?zbek\s*tilida\)?/gi, '');
  clean = clean.replace(/\(?tarjima\)?/gi, '');
  clean = clean.replace(/\(?(?:HD|720p|1080p|4K|Full HD)\)?/gi, '');
  clean = clean.replace(/#[\w_]+/g, '');
  clean = clean.replace(/[\(\)\[\]\-_:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

function getNextAutoCode() {
  const movies = db.getMovies();
  let maxCode = 2000;
  movies.forEach(m => {
    const num = parseInt(m.code, 10);
    if (!isNaN(num) && num >= maxCode) {
      maxCode = num;
    }
  });
  return (maxCode + 1).toString();
}

function detectGenre(caption) {
  if (!caption) return 'Triller (18+)';
  const lower = caption.toLowerCase();
  if (/qo['`’]?rqinchli|ужасы|horror|vampir|zombi/i.test(lower)) return 'Qo\'rqinchli (Horror 18+)';
  if (/triller|триллер|thriller|detektiv/i.test(lower)) return 'Triller (18+)';
  if (/jangari|boevik|боевик|action|spetsnaz/i.test(lower)) return 'Jangari (18+)';
  if (/psixologik|психологический/i.test(lower)) return 'Psixologik (18+)';
  if (/dokumental|документальный/i.test(lower)) return 'Dokumental (18+)';
  return 'Triller (18+)';
}

function isAdmin(userId) {
  const adminIdsStr = process.env.ADULT_ADMIN_IDS || process.env.ADMIN_ID || '6263659922';
  const adminIds = adminIdsStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
  return adminIds.includes(userId) || userId === 6263659922;
}

function getBotInstance() {
  return botInstance;
}

async function notifyNewMovie(movie) {
  if (!botInstance || !isBotRunning) return;
  const users = db.getUsers();
  const caption = `🔥 **YANGI 18+ VIDEO QO'SHILDI!**\n\n` +
    `🔞 **${movie.title}**\n` +
    `🗂 Janr: #${movie.genre || 'Triller (18+)'}\n` +
    `🔑 Kod: \`${movie.code}\`\n\n` +
    `💡 _Videoni tomosha qilish uchun botga \`${movie.code}\` kodini yuboring!_`;

  let index = 0;
  const interval = setInterval(async () => {
    if (index >= users.length) {
      clearInterval(interval);
      return;
    }
    const u = users[index++];
    try {
      if (movie.fileId) {
        await botInstance.api.sendVideo(u.id, movie.fileId, { caption, parse_mode: 'Markdown' });
      } else {
        await botInstance.api.sendMessage(u.id, caption, { parse_mode: 'Markdown' });
      }
    } catch (e) {}
  }, 40);
}

function getSingleBoshqaruvKeyboard() {
  return new Keyboard()
    .text('⚡️ Boshqaruv')
    .resized();
}

function getFullAdminKeyboard() {
  return new Keyboard()
    .text('📊 Statistika').text('👥 Foydalanuvchilar')
    .row()
    .text('🎬 Videolar').text('📫 Postlar')
    .row()
    .text('✉️ Xabar yuborish').text('📢 Reklama')
    .row()
    .text('🔐 Kanallar').text('📩 So\'rovlar')
    .row()
    .text('💳 To\'lov tizimlar').text('⚙️ Premium')
    .row()
    .text('📝 Matnlar').text('🔗 Referal')
    .row()
    .text('👮‍♂️ Adminlar').text('↗️ Ulashish')
    .row()
    .text('🌐 Web Panel')
    .row()
    .text('◀️ Orqaga')
    .resized();
}

async function startBot(botToken) {
  if (isBotRunning && botInstance) {
    return true;
  }

  try {
    botInstance = new Bot(botToken);

    // Global Grammy Error Handler - prevents ANY error from stopping/crashing the bot
    botInstance.catch((err) => {
      console.error('Grammy error caught safely:', err.error || err.message || err);
    });

    // Command: /start, /admin, /boshqaruv
    botInstance.command(['start', 'admin', 'boshqaruv'], async (ctx) => {
      const args = ctx.match ? ctx.match.trim() : '';
      let referrerId = null;
      if (args.startsWith('ref_')) {
        referrerId = args.replace('ref_', '');
      }

      db.addUser(ctx.from.id, ctx.from.username, ctx.from.first_name, referrerId);

      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      const name = escapeHtml(ctx.from.first_name || 'foydalanuvchi');
      let welcomeMsg = i18n.t(userLang, 'welcome', { name });

      if (isAdmin(ctx.from.id)) {
        return await ctx.reply(welcomeMsg, {
          parse_mode: 'HTML',
          reply_markup: getSingleBoshqaruvKeyboard()
        });
      }

      return await ctx.reply(welcomeMsg, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      });
    });

    // Admin Reply Keyboard Handlers
    botInstance.hears(['⚡️ Boshqaruv', '🛠 Boshqaruv', '/admin', '/boshqaruv'], async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      userPendingActions.delete(ctx.from.id);
      await ctx.reply(
        `⚡️ **18+ Video Bot Admin Paneliga xush kelibsiz!**\n\nQuyidagi amallardan birini tanlang:`,
        { parse_mode: 'Markdown', reply_markup: getFullAdminKeyboard() }
      );
    });

    // 1. Statistika
    botInstance.hears('📊 Statistika', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const users = db.getUsers();
      const movies = db.getMovies();
      const todayStr = new Date().toISOString().split('T')[0];
      const todayUsers = users.filter(u => u.joinedDate && u.joinedDate.startsWith(todayStr)).length;
      const totalViews = movies.reduce((sum, m) => sum + (m.views || 0), 0);

      await ctx.reply(
        `📊 **18+ Video Bot Statistikasi:**\n\n` +
        `👥 **Jami foydalanuvchilar:** \`${users.length}\` ta\n` +
        `📈 **Bugun qo'shilganlar:** \`${todayUsers}\` ta\n` +
        `🎬 **Jami 18+ videolar:** \`${movies.length}\` ta\n` +
        `👁 **Jami ko'rishlar:** \`${totalViews}\` marta\n` +
        `🟢 **Bot holati:** \`Online\``,
        { parse_mode: 'Markdown' }
      );
    });

    // 2. Foydalanuvchilar
    botInstance.hears('👥 Foydalanuvchilar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const users = db.getUsers();
      const keyboard = new InlineKeyboard()
        .text('📋 Oxirgi a\'zolar', 'usr_latest')
        .text('🔍 ID bo\'yicha izlash', 'usr_search_prompt')
        .row()
        .text('✉️ Shaxsiy xabar', 'usr_pm_prompt');

      await ctx.reply(
        `👥 **Foydalanuvchilar Bo'limi:**\n\n` +
        `Baza foydalanuvchilari soni: **${users.length}** ta\n\n` +
        `💡 Biror amalan tanlang yoki Veb Panelda batafsil ko'ring:\n👉 http://94.237.103.133/panel/#/users`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    });

    // 3. Videolar
    botInstance.hears('🎬 Videolar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const movies = db.getMovies();
      const keyboard = new InlineKeyboard()
        .text('📋 Kinolar ro\'yxati', 'mv_list:0')
        .text('🗑 Kodi bo\'yicha o\'chirish', 'mv_del_prompt')
        .row()
        .text('➕ Yangi video qo\'shish', 'mv_add_info');

      await ctx.reply(
        `🎬 **18+ Videolar Katalogi:**\n\n` +
        `Jami 18+ videolar soni: **${movies.length}** ta\n\n` +
        `💡 Videolarni botga rasm/video qilib yuborsangiz avto-parser ishlaydi!\n` +
        `Veb panelda alohida saqlangan kinolar: http://94.237.103.133/panel/#/adult-movies`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    });

    // 4. Postlar / Avto-Parser
    botInstance.hears('📫 Postlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const movies = db.getMovies();
      const autoAdded = movies.filter(m => m.code >= 2000).length;
      await ctx.reply(
        `📫 **Postlar va Avto-Parser:**\n\n` +
        `⚡️ Bot yoki kanalga video post yuborganingizda, tizim avtomatik kodi va nomini oladi.\n\n` +
        `📊 **Avto-parsed videolar:** \`${autoAdded}\` ta`,
        { parse_mode: 'Markdown' }
      );
    });

    // 5. Xabar yuborish (Broadcast)
    botInstance.hears('✉️ Xabar yuborish', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      userPendingActions.set(ctx.from.id, { action: 'broadcast_input' });
      await ctx.reply(
        `✉️ **Ommaviy Xabar Yuborish (Broadcast):**\n\n` +
        `Barcha bot foydalanuvchilariga yubormoqchi bo'lgan xabaringizni (matn, rasm yoki video) yuboring:`,
        { parse_mode: 'Markdown' }
      );
    });

    // Listen for Telegram Join Requests ("Zayafkalar")
    botInstance.on('chat_join_request', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const chatId = ctx.chat?.id;
        const username = ctx.chat?.username;
        const inviteLink = ctx.chatJoinRequest?.invite_link?.invite_link || '';

        if (chatId) db.recordJoinRequest(userId, chatId);
        if (username) db.recordJoinRequest(userId, `@${username}`);
        if (inviteLink) {
          const match = inviteLink.match(/t\.me\/(?:\+|\+joinchat\/|joinchat\/)?([a-zA-Z0-9_-]+)/);
          if (match && match[1]) db.recordJoinRequest(userId, match[1]);
        }
      } catch (e) {}
    });

    // Multi-Channel (Up to 5) Subscription Checker with Zayafka Support
    async function checkUserSubscriptions(ctx, userId) {
      if (isAdmin(userId)) return { isSubscribed: true, missingChannels: [] };
      const enabled = process.env.ADULT_SPONSOR_CHANNEL_ENABLED === 'true';
      if (!enabled) return { isSubscribed: true, missingChannels: [] };

      const channels = db.getChannels();
      if (!channels || channels.length === 0) return { isSubscribed: true, missingChannels: [] };

      const missingChannels = [];
      for (const ch of channels) {
        // 1. Check if DB recorded user's join request or verification click for this channel
        if (db.hasJoinedOrRequested(userId, ch)) {
          continue; // Subscribed/verified
        }

        let raw = (ch.username || ch.link || ch.chatId || '').trim();

        // If channel is a private invite link (t.me/+... or t.me/joinchat)
        const isInviteLink = raw.includes('t.me/+') || raw.includes('joinchat') || raw.includes('/+') || (raw.startsWith('http') && !raw.includes('/@'));

        if (isInviteLink) {
          // Private invite links cannot be queried via getChatMember API.
          // Keep in missing channels list until user clicks "Obunani tekshirish" or join request is recorded.
          missingChannels.push(ch);
          continue;
        }

        let target = raw.replace(/^https?:\/\/t\.me\//, '').replace('/', '');
        if (!target.startsWith('@') && !target.startsWith('-100') && !target.startsWith('http')) {
          target = '@' + target;
        }

        try {
          if (target.startsWith('@') || target.startsWith('-100')) {
            const member = await ctx.api.getChatMember(target, userId);
            const status = member.status;
            if (status === 'creator' || status === 'administrator' || status === 'member') {
              db.recordJoinRequest(userId, target);
              continue; // Subscribed
            }
          }
        } catch (e) {
          // If getChatMember throws an error (e.g. Bot is not admin in channel), DO NOT block users for bot setup error!
          console.warn(`[18+ Sponsor Warning] Cannot verify getChatMember for "${target}":`, e.message);
          db.recordJoinRequest(userId, target);
          continue;
        }

        missingChannels.push(ch);
      }

      return {
        isSubscribed: missingChannels.length === 0,
        missingChannels,
        allChannels: channels
      };
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function sendSubscriptionPrompt(ctx, missingChannels) {
      const keyboard = new InlineKeyboard();
      missingChannels.forEach((ch, i) => {
        const title = ch.title || `📢 ${i + 1}-Kanal`;
        let link = ch.link || '';
        if (!link && ch.username) {
          link = `https://t.me/${ch.username.replace('@', '')}`;
        }
        keyboard.url(title, link || 'https://t.me/').row();
      });
      keyboard.text('✅ Obunani tekshirish', 'check_sub').row();

      const msg = `⚠️ <b>Botdan foydalanish uchun barcha kanallarga obuna bo'lib, "✅ Obunani tekshirish" tugmasini bosing!</b>`;

      await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    // 6. Reklama & Kanallar
    botInstance.hears(['📢 Reklama', '🔐 Kanallar'], async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const enabled = process.env.ADULT_SPONSOR_CHANNEL_ENABLED === 'true';
      const channels = db.getChannels();

      const keyboard = new InlineKeyboard()
        .text('➕ Kanal qo\'shish', 'chan_add_prompt')
        .text('📋 Ro\'yxat (5 ta)', 'chan_list')
        .row()
        .text('⚙️ Obunani yoqish/o\'chirish', 'chan_toggle')
        .text('🗑 Barchasini o\'chirish', 'chan_del_prompt');

      let chanListText = channels.length === 0 ? '<i>Homiy kanallar topilmadi</i>\n' : '';
      channels.forEach((ch, idx) => {
        const title = escapeHtml(ch.title || 'Homiy Kanal');
        const handle = escapeHtml(ch.username || ch.link || 'yoq');
        chanListText += `${idx + 1}. <b>${title}</b> (${handle})\n`;
      });

      await ctx.reply(
        `🔐 <b>Majburiy Obuna Kanallari Sozlamalari (Max 5 ta):</b>\n\n` +
        `📢 <b>Joriy Kanallar (${channels.length}/5):</b>\n${chanListText}\n` +
        `⚙️ <b>Holati:</b> ${enabled ? '🟢 Yoqilgan' : '🔴 O\'chirilgan'}`,
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
    });

    // 7. So'rovlar
    botInstance.hears('📩 So\'rovlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const reqs = db.getRequests();
      const pendingReqs = reqs.filter(r => r.status === 'pending');

      if (pendingReqs.length === 0) {
        return await ctx.reply(`📩 **Foydalanuvchilar So'rovlari:**\n\nHozircha kutilayotgan so'rovlar yo'q.`, { parse_mode: 'Markdown' });
      }

      let text = `📩 **Kutilayotgan So'rovlar (${pendingReqs.length} ta):**\n\n`;
      const keyboard = new InlineKeyboard();

      pendingReqs.slice(0, 5).forEach((r, idx) => {
        text += `${idx + 1}. **${r.query}** (User ID: \`${r.userId}\` @${r.username || 'username_yoq'})\n`;
        keyboard.text(`✅ #${idx + 1}`, `req_cmp:${r.id}`).text(`🗑 #${idx + 1}`, `req_del:${r.id}`).row();
      });

      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    });

    // 8. To'lov tizimlari
    botInstance.hears('💳 To\'lov tizimlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      await ctx.reply(`💳 **To'lov Tizimlari Sozlamalari:**\n\nBot hozircha barcha xizmatlar bepul rejimda ishlamoqda. Veb panel orqali to'lov integratsiyasini ulashingiz mumkin.`, { parse_mode: 'Markdown' });
    });

    // 9. Premium
    botInstance.hears('⚙️ Premium', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const users = db.getUsers();
      const vipUsers = users.filter(u => u.isVip);

      const keyboard = new InlineKeyboard()
        .text('➕ VIP berish', 'vip_add_prompt')
        .text('➖ VIP olish', 'vip_rem_prompt');

      await ctx.reply(
        `⚙️ **Premium / VIP Foydalanuvchilar:**\n\n` +
        `👑 VIP a'zolar soni: **${vipUsers.length}** ta\n\n` +
        `Yangi a'zoga VIP maqomini berish uchun quyidagi tugmani bosing:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    });

    // 10. Matnlar
    botInstance.hears('📝 Matnlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const userLang = db.getUserLang(ctx.from.id) || 'uz';
      const welcomeText = i18n.t(userLang, 'welcome', { name: ctx.from.first_name });
      await ctx.reply(
        `📝 **Bot Xabar Matnlari:**\n\n` +
        `**Joriy Salomlashuv Xabari:**\n${welcomeText}\n\n` +
        `💡 Veb panel orqali matnlarni sozlashingiz mumkin.`,
        { parse_mode: 'Markdown' }
      );
    });

    // 11. Referal
    botInstance.hears('🔗 Referal', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const users = db.getUsers();
      const topRefs = users.filter(u => (u.referralCount || 0) > 0).sort((a, b) => (b.referralCount || 0) - (a.referralCount || 0)).slice(0, 5);

      let text = `🔗 **Referal Tizimi Statistikasi:**\n\n🏆 **Top Referallar:**\n`;
      if (topRefs.length === 0) {
        text += `_Hali taklif qilganlar yo'q_\n`;
      } else {
        topRefs.forEach((u, i) => {
          text += `${i + 1}. ID: \`${u.id}\` (@${u.username || 'anon'}) - **${u.referralCount}** ta taklif\n`;
        });
      }

      await ctx.reply(text, { parse_mode: 'Markdown' });
    });

    // 12. Adminlar
    botInstance.hears('👮‍♂️ Adminlar', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const adminIds = db.getAdminIds();
      const keyboard = new InlineKeyboard()
        .text('➕ Admin qo\'shish', 'admin_add_prompt')
        .text('➖ Adminni o\'chirish', 'admin_del_prompt')
        .row()
        .text('📋 Adminlar ro\'yxati', 'admin_list');

      await ctx.reply(
        `👮‍♂️ **Adminlarni Boshqarish:**\n\n` +
        `📜 **Joriy Admin Telegram ID'lar:**\n\`${adminIds.join(', ')}\``,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    });

    // 13. Ulashish
    botInstance.hears('↗️ Ulashish', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const username = process.env.ADULT_BOT_USERNAME || 'adult_video_bot';
      const shareUrl = `https://t.me/share/url?url=https://t.me/${username}&text=18%2B%20Videolar%20va%20Filmlar%20Boti`;
      const keyboard = new InlineKeyboard().url('↗️ Botni Ulashish', shareUrl);
      await ctx.reply(`↗️ **Botni Do'stlarga Ulashish:**`, { parse_mode: 'Markdown', reply_markup: keyboard });
    });

    // 14. Web Panel
    botInstance.hears('🌐 Web Panel', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      const keyboard = new InlineKeyboard().url('🚀 18+ Web Panelga Kirish', 'http://94.237.103.133/panel/#/adult-bot');
      await ctx.reply(
        `🌐 **18+ Video Bot Boshqaruv Paneli:**\n\n` +
        `Barcha sozlamalar va 18+ kinolarni veb sahifada boshqarish uchun havolani bosing:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    });

    // 15. Orqaga
    botInstance.hears('◀️ Orqaga', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return;
      userPendingActions.delete(ctx.from.id);
      await ctx.reply(`◀️ Boshqaruv menyusi yopildi.`, {
        reply_markup: getSingleBoshqaruvKeyboard()
      });
    });

    // Inline Callbacks Handling
    botInstance.callbackQuery('admin_list', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      const adminIds = db.getAdminIds();
      await ctx.reply(`📋 **Joriy Admin ID'lar:**\n\n\`${adminIds.join(', ')}\``, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('admin_add_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'admin_add_prompt' });
      await ctx.reply(`➕ **Yangi Admin ID qo'shish:**\n\nYangi adminning Telegram ID raqamini yozib yuboring (masalan: \`123456789\`):`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('admin_del_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'admin_del_prompt' });
      await ctx.reply(`➖ **Adminni o'chirish:**\n\nO'chirmoqchi bo'lgan adminning Telegram ID raqamini yuboring:`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('check_sub', async (ctx) => {
      const userId = ctx.from.id;
      const channels = db.getChannels();

      // Record verification for all channels on click
      channels.forEach(ch => {
        if (ch.link) {
          db.recordJoinRequest(userId, ch.link);
          const match = ch.link.match(/t\.me\/(?:\+|\+joinchat\/|joinchat\/)?([a-zA-Z0-9_-]+)/);
          if (match && match[1]) db.recordJoinRequest(userId, match[1]);
        }
        if (ch.username) {
          db.recordJoinRequest(userId, ch.username);
          const match = ch.username.match(/t\.me\/(?:\+|\+joinchat\/|joinchat\/)?([a-zA-Z0-9_-]+)/);
          if (match && match[1]) db.recordJoinRequest(userId, match[1]);
        }
        if (ch.id) db.recordJoinRequest(userId, ch.id);
      });

      const check = await checkUserSubscriptions(ctx, userId);
      if (check.isSubscribed) {
        await ctx.answerCallbackQuery({ text: '✅ Rahmat! Obuna tasdiqlandi.' });
        try { await ctx.deleteMessage(); } catch (e) {}
        const userLang = db.getUserLang(userId) || 'uz';
        const name = escapeHtml(ctx.from.first_name || 'foydalanuvchi');
        const welcomeMsg = i18n.t(userLang, 'welcome', { name });
        await ctx.reply(`🎉 <b>Obuna tasdiqlandi!</b>\n\n${welcomeMsg}`, {
          parse_mode: 'HTML',
          reply_markup: isAdmin(userId) ? getSingleBoshqaruvKeyboard() : { remove_keyboard: true }
        });
      } else {
        await ctx.answerCallbackQuery({ text: `❌ Siz hali ${check.missingChannels.length} ta kanalga obuna bo'lmadingiz!`, show_alert: true });
        try { await ctx.deleteMessage(); } catch (e) {}
        await sendSubscriptionPrompt(ctx, check.missingChannels);
      }
    });

    botInstance.callbackQuery('chan_list', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      const enabled = process.env.ADULT_SPONSOR_CHANNEL_ENABLED === 'true';
      const channels = db.getChannels();
      let text = `📋 <b>Majburiy Obuna Kanallari Ro'yxati (${channels.length}/5):</b>\n\n`;
      if (channels.length === 0) text += `<i>Hech qanday kanal kiritilmagan</i>\n`;
      channels.forEach((ch, idx) => {
        const title = escapeHtml(ch.title || 'Kanal');
        const username = escapeHtml(ch.username || 'yoq');
        const link = escapeHtml(ch.link || 'yoq');
        text += `${idx + 1}. <b>${title}</b>\n   Username: <code>${username}</code>\n   Link: ${link}\n\n`;
      });
      text += `Holati: <b>${enabled ? '🟢 Yoqilgan' : '🔴 O\'chirilgan'}</b>`;
      await ctx.reply(text, { parse_mode: 'HTML' });
    });

    botInstance.callbackQuery('chan_add_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      const channels = db.getChannels();
      if (channels.length >= 5) {
        return await ctx.reply(`⚠️ **Maksimal 5 ta kanal qo'shish mumkin!**\nO'rniga boshqasini qo'shish uchun avval eskisini o'chiring.`);
      }
      userPendingActions.set(ctx.from.id, { action: 'chan_add_prompt' });
      await ctx.reply(`➕ **Yangi Homiy Kanal Qo'shish (Joriy: ${channels.length}/5):**\n\nKanal nomi, username hamda havolasini yuboring:\nMisol: \`Kino Kanal @kinokanal https://t.me/kinokanal\``, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('chan_del_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      db.saveChannels([]);
      process.env.ADULT_SPONSOR_CHANNEL_USERNAME = '';
      process.env.ADULT_SPONSOR_CHANNEL_LINK = '';
      await ctx.reply(`🗑 **Barcha homiy kanallar o'chirildi.**`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('chan_toggle', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      const current = process.env.ADULT_SPONSOR_CHANNEL_ENABLED === 'true';
      const next = (!current).toString();
      process.env.ADULT_SPONSOR_CHANNEL_ENABLED = next;
      await ctx.reply(`⚙️ Majburiy obuna holati: **${next === 'true' ? '🟢 Yoqildi' : '🔴 O\'chirildi'}**`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('usr_latest', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      const users = db.getUsers().slice(-10).reverse();
      let text = `📋 **Oxirgi 10 ta foydalanuvchi:**\n\n`;
      users.forEach((u, i) => {
        text += `${i + 1}. ID: \`${u.id}\` | ${u.firstName || 'Anon'} (@${u.username || 'username_yoq'})\n`;
      });
      await ctx.reply(text, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('usr_search_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'search_user_prompt' });
      await ctx.reply(`🔍 Qidirmoqchi bo'lgan foydalanuvchining Telegram ID raqamini kiriting:`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('usr_pm_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'pm_user_prompt' });
      await ctx.reply(`✉️ Shaxsiy xabar yuborish uchun user ID va matnni yozing:\nMisol: \`123456789 Salom botimizga xush kelibsiz\``, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery(/^mv_list:(\d+)$/, async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      const page = parseInt(ctx.match[1], 10) || 0;
      const movies = db.getMovies();
      const pageSize = 5;
      const totalPages = Math.ceil(movies.length / pageSize) || 1;
      const slice = movies.slice(page * pageSize, (page + 1) * pageSize);

      let replyText = `🎬 **18+ Kinolar Katalogi (${page + 1}/${totalPages}-sahifa):**\n\n`;
      const keyboard = new InlineKeyboard();

      slice.forEach((m, idx) => {
        replyText += `${page * pageSize + idx + 1}. *${m.title}* - Kod: \`${m.code}\`\n`;
        keyboard.text(`🗑 Kod ${m.code}`, `mv_del:${m.code}`).row();
      });

      const navRow = [];
      if (page > 0) navRow.push(InlineKeyboard.text('◀️ Oldingi', `mv_list:${page - 1}`));
      if (page < totalPages - 1) navRow.push(InlineKeyboard.text('Keyingi ▶️', `mv_list:${page + 1}`));
      if (navRow.length > 0) keyboard.row(...navRow);

      await ctx.reply(replyText, { parse_mode: 'Markdown', reply_markup: keyboard });
    });

    botInstance.callbackQuery('mv_del_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'movie_del_prompt' });
      await ctx.reply(`🗑 O'chirmoqchi bo'lgan 18+ video kodini yuboring (masalan: \`2001\`):`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery(/^mv_del:(.+)$/, async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      const code = ctx.match[1];
      await ctx.answerCallbackQuery();
      const ok = db.deleteMovie(code);
      if (ok) {
        await ctx.reply(`✅ 18+ Video (Kod: \`${code}\`) o'chirildi.`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`❌ Kod: \`${code}\` bo'yicha video topilmadi.`, { parse_mode: 'Markdown' });
      }
    });

    botInstance.callbackQuery('mv_add_info', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `➕ **Yangi 18+ Video qo'shish yo'riqnomasi:**\n\n` +
        `1️⃣ Botga yoki ulangan kanalga video faylni sarlavhasi (caption) bilan yuboring.\n` +
        `2️⃣ Bot avtomatik kodi (\`2001\`, \`2002\`...) va sarlavhasini olib 18+ video bazasiga joylaydi!\n` +
        `3️⃣ Yoki Veb Panel sahifasi orqali qo'shing: http://94.237.103.133/panel/#/adult-movies`,
        { parse_mode: 'Markdown' }
      );
    });

    botInstance.callbackQuery(/^req_cmp:(.+)$/, async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      const id = ctx.match[1];
      await ctx.answerCallbackQuery();
      db.completeRequest(id);
      await ctx.reply(`✅ So'rov bajarildi deb belgilandi!`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery(/^req_del:(.+)$/, async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      const id = ctx.match[1];
      await ctx.answerCallbackQuery();
      db.deleteRequest(id);
      await ctx.reply(`🗑 So'rov o'chirildi!`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('vip_add_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'vip_add_prompt' });
      await ctx.reply(`👑 VIP maqomi beriladigan foydalanuvchining Telegram ID raqamini kiriting:`, { parse_mode: 'Markdown' });
    });

    botInstance.callbackQuery('vip_rem_prompt', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      userPendingActions.set(ctx.from.id, { action: 'vip_rem_prompt' });
      await ctx.reply(`➖ VIP maqomi olib tashlanadigan foydalanuvchi ID raqamini kiriting:`, { parse_mode: 'Markdown' });
    });

    // Broadcast confirmation callbacks
    botInstance.callbackQuery('bcast_confirm', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      if (!pendingBroadcastMessage) {
        return await ctx.reply(`❌ Ommaviy xabar ma'lumoti topilmadi.`);
      }

      const users = db.getUsers();
      await ctx.reply(`🚀 Ommaviy xabar **${users.length}** ta foydalanuvchiga yuborilmoqda...`);

      let sent = 0, failed = 0;
      const bMsg = pendingBroadcastMessage;
      pendingBroadcastMessage = null;

      let index = 0;
      const interval = setInterval(async () => {
        if (index >= users.length) {
          clearInterval(interval);
          return await ctx.reply(`✅ **Ommaviy xabar yakunlandi!**\n\nMuvaffaqiyatli: **${sent}** ta\nXatolik: **${failed}** ta`, { parse_mode: 'Markdown' });
        }
        const u = users[index++];
        try {
          if (bMsg.photo) {
            await botInstance.api.sendPhoto(u.id, bMsg.photo, { caption: bMsg.caption, parse_mode: 'HTML' });
          } else if (bMsg.video) {
            await botInstance.api.sendVideo(u.id, bMsg.video, { caption: bMsg.caption, parse_mode: 'HTML' });
          } else {
            await botInstance.api.sendMessage(u.id, bMsg.text, { parse_mode: 'HTML' });
          }
          sent++;
        } catch (e) {
          failed++;
        }
      }, 40);
    });

    botInstance.callbackQuery('bcast_cancel', async (ctx) => {
      if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Ruxsat yo\'q' });
      await ctx.answerCallbackQuery();
      pendingBroadcastMessage = null;
      await ctx.reply(`❌ Ommaviy xabar yuborish bekor qilindi.`);
    });

    // Auto-parser from channel posts or admin forwarded videos
    botInstance.on(['message:video', 'message:document'], async (ctx) => {
      try {
        if (!ctx.from || !isAdmin(ctx.from.id)) return;

        const pending = userPendingActions.get(ctx.from.id);
        if (pending && pending.action === 'broadcast_input') {
          userPendingActions.delete(ctx.from.id);
          const videoId = ctx.message.video ? ctx.message.video.file_id : ctx.message.document.file_id;
          pendingBroadcastMessage = { video: videoId, caption: ctx.message.caption || '' };
          const keyboard = new InlineKeyboard().text('✅ Yuborishni tasdiqlash', 'bcast_confirm').text('❌ Bekor qilish', 'bcast_cancel');
          return await ctx.reply(`📹 **Videoli xabar qabul qilindi.** Barcha a'zolarga yuborilsinmi?`, { reply_markup: keyboard });
        }

        const video = ctx.message.video || (ctx.message.document && ctx.message.document.mime_type && ctx.message.document.mime_type.startsWith('video/') ? ctx.message.document : null);
        if (!video) return;

        const fileId = video.file_id;
        const rawCaption = (ctx.message.caption || '').trim();

        let explicitCode = null;
        const codeMatch = rawCaption.match(/\b(?:kino\s*kodi|serial\s*kodi|kod[i]?|code)\b[\s:-]*([0-9a-zA-Z_-]+)/i);
        if (codeMatch && codeMatch[1]) {
          const cand = codeMatch[1].trim();
          const reservedWords = ['nomi', 'title', 'kino', 'serial', 'film', 'janr', 'janri', 'qism', 'mavsum', 'sezon', 'season', 'larni', 'barcha', 'bepul', 'orqali', 'tomosha'];
          if (!reservedWords.includes(cand.toLowerCase())) {
            explicitCode = cand;
          }
        }

        const cleanLines = rawCaption.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#') && !l.includes('@') && !l.includes('http://') && !l.includes('https://') && !l.includes('t.me/') && !/orqali|tomosha|bepul|obuna/i.test(l));

        let rawTitle = '';
        const titleMatch = rawCaption.match(/\b(?:kino\s*nomi|serial\s*nomi|nomi|title)\b[\s:-]*([^\n]+)/i);
        if (titleMatch && titleMatch[1]) {
          const matchedLine = titleMatch[1].trim();
          if (!matchedLine.includes('@') && !/orqali|tomosha|bepul/i.test(matchedLine)) {
            rawTitle = matchedLine;
          }
        }

        if (!rawTitle && cleanLines.length > 0) {
          rawTitle = cleanLines[0].replace(/\b(?:kino|film|serial|kodi|kod|nomi)\b[\s:-]*/gi, '').trim();
        }

        let title = cleanAdText(extractCleanTitle(rawTitle));
        if (!title || title.length < 2) {
          title = cleanLines.length > 0 ? extractCleanTitle(cleanLines[0]) : '';
        }

        const movieData = {
          code: explicitCode,
          title: title || `18+ Video #${getNextAutoCode()}`,
          description: cleanAdText(rawCaption),
          genre: detectGenre(rawCaption),
          fileId: fileId
        };

        if (explicitCode) {
          const result = db.addMovie(movieData);
          if (result) {
            await ctx.reply(
              `⚡️ **18+ Video bazaga muvaffaqiyatli qo'shildi!**\n\n` +
              `🔑 **Video kodi:** \`${result.code}\`\n` +
              `🎬 **Nomi:** *${result.title}*\n` +
              `🗂 **Janri:** _${result.genre}_\n` +
              `📁 **File ID:** \`${result.fileId.substring(0, 20)}...\`\n\n` +
              `💡 *Foydalanuvchilar botda \`${result.code}\` kodini kiritib tomosha qilishlari mumkin!*`,
              { parse_mode: 'Markdown' }
            );
          }
        } else {
          // Ask admin to enter code explicitly!
          userPendingActions.set(ctx.from.id, {
            action: 'admin_video_code',
            movieData
          });

          const autoSug = getNextAutoCode();
          await ctx.reply(
            `📹 **18+ Video qabul qilindi!**\n\n` +
            `✍️ **Admin, iltimos ushbu video uchun KOD kiriting:**\n` +
            `(Tavsiya: \`${autoSug}\` yoki xohlagan boshqa kodingizni yozib yuboring):`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err) {
        console.error('Error in 18+ admin video auto-parser:', err.message);
      }
    });

    botInstance.on('message:photo', async (ctx) => {
      if (!ctx.from || !isAdmin(ctx.from.id)) return;
      const pending = userPendingActions.get(ctx.from.id);
      if (pending && pending.action === 'broadcast_input') {
        userPendingActions.delete(ctx.from.id);
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        pendingBroadcastMessage = { photo: photoId, caption: ctx.message.caption || '' };
        const keyboard = new InlineKeyboard().text('✅ Yuborishni tasdiqlash', 'bcast_confirm').text('❌ Bekor qilish', 'bcast_cancel');
        return await ctx.reply(`🖼 **Rasmli xabar qabul qilindi.** Barcha a'zolarga yuborilsinmi?`, { reply_markup: keyboard });
      }
    });

    // Handle user text queries & admin pending actions
    botInstance.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const userId = ctx.from.id;

      if (text.startsWith('/')) return; // Ignore commands

      // Admin pending interactive actions
      if (isAdmin(userId) && userPendingActions.has(userId)) {
        const pending = userPendingActions.get(userId);
        userPendingActions.delete(userId);

        if (pending.action === 'admin_video_code') {
          const customCode = text.trim();
          const movieData = {
            ...pending.movieData,
            code: customCode
          };
          const result = db.addMovie(movieData);
          if (result) {
            return await ctx.reply(
              `⚡️ **18+ Video bazaga muvaffaqiyatli qo'shildi!**\n\n` +
              `🔑 **Admin kodi:** \`${result.code}\`\n` +
              `🎬 **Nomi:** *${result.title}*\n` +
              `🗂 **Janri:** _${result.genre}_\n\n` +
              `💡 *Foydalanuvchilar botda \`${result.code}\` kodini kiritib tomosha qilishlari mumkin!*`,
              { parse_mode: 'Markdown' }
            );
          } else {
            return await ctx.reply(`❌ Videoni saqlashda xatolik yuz berdi.`);
          }
        }

        if (pending.action === 'broadcast_input') {
          pendingBroadcastMessage = { text };
          const keyboard = new InlineKeyboard().text('✅ Yuborishni tasdiqlash', 'bcast_confirm').text('❌ Bekor qilish', 'bcast_cancel');
          return await ctx.reply(`✉️ **Matnli xabar qabul qilindi:**\n\n"${text}"\n\nBarcha a'zolarga yuborilsinmi?`, { reply_markup: keyboard });
        }

        if (pending.action === 'admin_add_prompt') {
          const ok = db.addAdminId(text);
          if (ok) return await ctx.reply(`✅ Yangi Admin ID \`${text}\` qo'shildi!`, { parse_mode: 'Markdown' });
          else return await ctx.reply(`❌ Noto'g'ri ID yoki allaqachon mavjud.`);
        }

        if (pending.action === 'admin_del_prompt') {
          const ok = db.removeAdminId(text);
          if (ok) return await ctx.reply(`✅ Admin ID \`${text}\` olib tashlandi!`, { parse_mode: 'Markdown' });
          else return await ctx.reply(`❌ Admin ID topilmadi.`);
        }

        if (pending.action === 'chan_add_prompt') {
          const channels = db.getChannels();
          if (channels.length >= 5) {
            return await ctx.reply(`⚠️ Maksimal 5 ta kanal kiritish mumkin.`);
          }

          const parts = text.split(/\s+/);
          let title = 'Homiy Kanal';
          let username = '';
          let link = '';

          parts.forEach(p => {
            if (p.startsWith('@')) username = p;
            else if (p.startsWith('http')) link = p;
            else if (!title || title === 'Homiy Kanal') title = p;
            else title += ' ' + p;
          });

          if (!username && parts.length > 0) username = parts[0];
          if (!link && username) link = `https://t.me/${username.replace('@', '')}`;

          const newChan = {
            id: Date.now().toString(),
            title: title.trim() || `📢 ${channels.length + 1}-Kanal`,
            username: username.trim(),
            link: link.trim()
          };

          channels.push(newChan);
          db.saveChannels(channels);
          process.env.ADULT_SPONSOR_CHANNEL_ENABLED = 'true';

          return await ctx.reply(`✅ **${channels.length}-Homiy kanal saqlandi:**\n\n📌 Nomi: **${newChan.title}**\n👤 Username: \`${newChan.username}\`\n🔗 Havola: ${newChan.link}`, { parse_mode: 'Markdown' });
        }

        if (pending.action === 'search_user_prompt') {
          const u = db.getUsers().find(x => String(x.id) === text);
          if (u) {
            const kb = new InlineKeyboard().text(u.banned ? '🟢 Ban yechish' : '🔴 Ban qilish', `usr_ban:${u.id}`);
            return await ctx.reply(`👤 **Foydalanuvchi ma'lumoti:**\n\nID: \`${u.id}\`\nNomi: ${u.firstName}\nUsername: @${u.username || 'yoq'}\nQo'shilgan: ${u.joinedDate}\nHolati: ${u.banned ? '🔴 Banned' : '🟢 Active'}`, { parse_mode: 'Markdown', reply_markup: kb });
          } else {
            return await ctx.reply(`❌ User ID \`${text}\` topilmadi.`);
          }
        }

        if (pending.action === 'pm_user_prompt') {
          const spaceIdx = text.indexOf(' ');
          if (spaceIdx > 0) {
            const targetId = text.substring(0, spaceIdx).trim();
            const msgText = text.substring(spaceIdx + 1).trim();
            try {
              await botInstance.api.sendMessage(targetId, msgText);
              return await ctx.reply(`✅ Foydalanuvchiga xabar yuborildi!`);
            } catch (e) {
              return await ctx.reply(`❌ Xabar yuborishda xatolik: ${e.message}`);
            }
          } else {
            return await ctx.reply(`❌ Noto'g'ri format. Misol: \`123456789 Salom\``);
          }
        }

        if (pending.action === 'movie_del_prompt') {
          const ok = db.deleteMovie(text);
          if (ok) return await ctx.reply(`✅ 18+ Video (Kod: \`${text}\`) muvaffaqiyatli o'chirildi!`, { parse_mode: 'Markdown' });
          else return await ctx.reply(`❌ Kod \`${text}\` bo'yicha video topilmadi.`, { parse_mode: 'Markdown' });
        }

        if (pending.action === 'vip_add_prompt') {
          const ok = db.setVip(text, true);
          if (ok) return await ctx.reply(`👑 Foydalanuvchi \`${text}\` VIP maqomiga ega bo'ldi!`, { parse_mode: 'Markdown' });
          else return await ctx.reply(`❌ Foydalanuvchi topilmadi.`);
        }

        if (pending.action === 'vip_rem_prompt') {
          const ok = db.setVip(text, false);
          if (ok) return await ctx.reply(`➖ Foydalanuvchi \`${text}\` VIP maqomi olib tashlandi.`, { parse_mode: 'Markdown' });
          else return await ctx.reply(`❌ Foydalanuvchi topilmadi.`);
        }
      }

      db.addUser(userId, ctx.from.username, ctx.from.first_name);

      // Check Mandatory Subscriptions for non-admin users
      const check = await checkUserSubscriptions(ctx, userId);
      if (!check.isSubscribed) {
        return await sendSubscriptionPrompt(ctx, check.missingChannels);
      }

      const userLang = db.getUserLang(userId) || 'uz';

      // Search by code
      const movie = db.findMovieByCode(text);
      if (movie) {
        return await sendMovie(ctx, movie);
      }

      // Search by title
      const titleMatches = db.searchMoviesByTitle(text);
      if (titleMatches.length > 0) {
        if (titleMatches.length === 1) {
          return await sendMovie(ctx, titleMatches[0]);
        }
        let replyText = `🔍 **"${text}" bo'yicha topilgan 18+ videolar:**\n\n`;
        const keyboard = new InlineKeyboard();
        titleMatches.slice(0, 10).forEach((m, idx) => {
          replyText += `${idx + 1}. *${m.title}* - Kod: \`${m.code}\`\n`;
          keyboard.text(`${idx + 1} 🎬`, `mv:${m.code}`).row();
        });
        return await ctx.reply(replyText, { parse_mode: 'Markdown', reply_markup: keyboard });
      }

      return await ctx.reply(i18n.t(userLang, 'code_not_found', { code: escapeHtml(text) }), { parse_mode: 'HTML' });
    });

    isBotRunning = true;
    botInstance.start({
      allowed_updates: ["message", "callback_query", "chat_join_request", "chat_member"],
      onStart: (info) => {
        isBotRunning = true;
        if (info && info.username) {
          process.env.ADULT_BOT_USERNAME = info.username;
        }
        console.log(`18+ Video Telegram Bot @${info.username} started successfully with zayafka listener.`);
      }
    }).catch((err) => {
      console.error('Error in 18+ Video Telegram Bot runner:', err.message);
      isBotRunning = false;
    });

    return true;
  } catch (err) {
    console.error('Failed to start 18+ Video Telegram Bot:', err.message);
    isBotRunning = false;
    botInstance = null;
    return false;
  }
}

async function sendMovie(ctx, movie) {
  try {
    const path = require('path');
    const serverDb = require(path.resolve(__dirname, '../server/db'));
    const isUserAdmin = ctx.from && isAdmin(ctx.from.id);
    serverDb.logActivity({
      bot: '18+ Adult Bot',
      type: isUserAdmin ? 'admin' : 'user',
      actor: isUserAdmin ? '👑 Admin' : '👤 Foydalanuvchi',
      icon: isUserAdmin ? '👑' : '🔞',
      text: isUserAdmin
        ? `👑 Admin '${movie.title}' 18+ videosini ko'rib chiqdi (Kod: ${movie.code})`
        : `👤 Foydalanuvchi '${movie.title}' 18+ videosini tomosha qildi (Kod: ${movie.code})`,
      color: '#ef4444'
    });
  } catch (e) {}

  const cleanTitle = escapeHtml(movie.title || '18+ Video');
  const cleanDesc = escapeHtml(movie.description || 'Tavsif berilmagan');
  const safeGenre = escapeHtml((movie.genre || 'Triller_18plus').replace(/\s+/g, '_').replace(/[^\w_]/g, ''));

  const captionText = `🔞 <b>${cleanTitle}</b>\n\n` +
    `🗂 Janr: #${safeGenre}\n` +
    `🔑 Kod: <code>${escapeHtml(movie.code)}</code>\n\n` +
    `📝 <i>${cleanDesc}</i>`;

  const keyboard = new InlineKeyboard()
    .text(`👍 🔥 ${movie.likes ? movie.likes.length : 0}`, `like:${movie.code}`)
    .text(`👎 ❄️ ${movie.dislikes ? movie.dislikes.length : 0}`, `dislike:${movie.code}`);

  try {
    return await ctx.replyWithVideo(movie.fileId, {
      caption: captionText,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    } catch (e) {
      return await ctx.reply(captionText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
}

function getBotStatus() {
  return {
    running: isBotRunning,
    botUsername: process.env.ADULT_BOT_USERNAME || 'adult_video_bot'
  };
}

async function stopBot() {
  if (botInstance && isBotRunning) {
    try {
      await botInstance.stop();
    } catch (e) {}
    isBotRunning = false;
    botInstance = null;
  }
  return true;
}

module.exports = {
  startBot,
  stopBot,
  getBotStatus,
  getBotInstance,
  notifyNewMovie
};
