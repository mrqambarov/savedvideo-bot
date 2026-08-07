const { Bot, InputFile, InlineKeyboard, Keyboard } = require('grammy');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execFile } = require('child_process');
const downloader = require('./downloader');
const processor = require('./processor');
const db = require('./db');
const i18n = require('./i18n');
const sponsorManager = require('./sponsorManager');

let botInstance = null;
let isBotRunning = false;

// URL cache to overcome Telegram's 64-byte callback_data limit
const urlCache = new Map();
const localVideoCache = new Map();
const searchCache = new Map();
const fileCache = new Map();
const userPendingActions = new Map();

/**
 * Formats duration in seconds to MM:SS format
 */
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Escapes special characters for HTML parsing in Telegram messages
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Tries to identify music from a file path using local metadata and Shazam API
 * @param {string} filePath 
 * @returns {Promise<object | null>} { title, artist } or null
 */
async function identifyMusicFromPath(filePath) {
  try {
    // A. Check local metadata first
    const local = await getFileMetadata(filePath);
    if (local && local.title && local.title !== 'Unknown Title') {
      return { title: local.title, artist: local.artist || 'Unknown Artist' };
    }

    // B. Shazam API fallback
    const apiKey = process.env.SHAZAM_RAPIDAPI_KEY;
    if (apiKey) {
      const fileId = Math.random().toString(36).substring(2, 8);
      const rawPcmPath = await processor.generateRawPcmForShazam(filePath, `id_tmp_${fileId}`);
      const match = await queryShazamAPI(rawPcmPath, apiKey);
      
      try {
        if (fs.existsSync(rawPcmPath)) fs.unlinkSync(rawPcmPath);
      } catch (e) {}

      if (match && match.title) {
        return { title: match.title, artist: match.artist || 'Unknown Artist' };
      }
    }
  } catch (err) {
    console.error('Error in identifyMusicFromPath:', err.message);
  }
  return null;
}

/**
 * Helper to run ffprobe and parse metadata tags from audio/video files
 * @param {string} filePath 
 * @returns {Promise<object | null>}
 */
function getFileMetadata(filePath) {
  return new Promise((resolve) => {
    execFile(processor.ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ], (err, stdout) => {
      if (err) return resolve(null);
      try {
        const data = JSON.parse(stdout);
        const tags = data.format && data.format.tags;
        if (tags && (tags.title || tags.artist)) {
          return resolve({
            title: tags.title || 'Unknown Title',
            artist: tags.artist || 'Unknown Artist',
            album: tags.album || 'Unknown Album'
          });
        }
        resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

/**
 * Downloads a file from Telegram server to a local path
 * @param {object} ctx Grammy context
 * @param {string} fileId 
 * @param {string} destPath 
 */
async function downloadTelegramFile(ctx, fileId, destPath) {
  const file = await ctx.api.getFile(fileId);
  
  // Warn if file is larger than 20MB (Telegram limit)
  if (file.file_size && file.file_size > 20 * 1024 * 1024) {
    throw new Error('Telegram limits bot file downloads to 20MB. Please send a smaller file.');
  }

  const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const response = await axios({
    method: 'GET',
    url: fileUrl,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Queries the Shazam API on RapidAPI with a base64 PCM snippet
 * @param {string} rawPcmPath 
 * @param {string} apiKey 
 * @returns {Promise<object | null>}
 */
async function queryShazamAPI(rawPcmPath, apiKey) {
  try {
    const rawData = fs.readFileSync(rawPcmPath);
    const base64Data = rawData.toString('base64');

    const response = await axios({
      method: 'POST',
      url: 'https://shazam.p.rapidapi.com/songs/detect',
      headers: {
        'content-type': 'text/plain',
        'x-rapidapi-host': 'shazam.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      },
      data: base64Data,
      timeout: 15000
    });

    if (response.data && response.data.track) {
      return {
        title: response.data.track.title,
        artist: response.data.track.subtitle,
        image: response.data.track.images && response.data.track.images.background,
        shareUrl: response.data.track.url
      };
    }
    return null;
  } catch (error) {
    console.error('Shazam API Query Error:', error.message);
    throw new Error('Shazam recognition failed: ' + (error.response?.data?.message || error.message));
  }
}
// Referral / contest info — shared by the /referal command and the keyboard button.
async function sendReferralInfo(ctx) {
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
    `Havolangizni do'stlaringizga ulashing. Har bir do'st bot orqali biror narsa yuklab olsa, sizga hisoblanadi.\n\n` +
    `🔗 Sizning havolangiz:\n\`${link}\`\n\n` +
    `✅ Muvaffaqiyatli takliflar: **${info.refCount}**\n` +
    `⏳ Kutilmoqda (hali yuklamagan): **${info.refPending}**\n` +
    `${rankLine}\n\n` +
    (top ? `🏅 **Eng faol taklif qiluvchilar:**\n${top}` : '');
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Video va musiqa yuklovchi zo\'r bot! 🚀')}`;
  const kb = new InlineKeyboard().url('📤 Do\'stlarga ulashish', shareUrl);
  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

function isAdmin(userId) {
  if (!userId) return false;
  const adminIdsStr = process.env.ADMIN_IDS || '';
  const adminIds = adminIdsStr.split(',').map(id => Number(id.trim())).filter(Boolean);
  return adminIds.includes(Number(userId));
}

function getDisplayName(from) {
  if (!from) return 'Foydalanuvchi';
  let name = (from.first_name || '').trim();
  if (from.last_name) {
    name += ' ' + from.last_name.trim();
  }
  if (!name && from.username) {
    name = '@' + from.username;
  }
  return name || 'Foydalanuvchi';
}

async function sendStatsReport(ctx) {
  const advStats = db.getAdvancedStats();
  const msg =
    `📊 **KUNLIK VA UMUMIY ANALITIKA**\n\n` +
    `📅 **Bugungi ko'rsatkichlar:**\n` +
    `• Yangi foydalanuvchilar: **${advStats.growth.newUsersToday}**\n` +
    `• Faol foydalanuvchilar: **${advStats.active.today}**\n` +
    `• Video yuklashlar: **${advStats.usage.today.downloadsVideo}**\n` +
    `• Audio yuklashlar: **${advStats.usage.today.downloadsAudio}**\n` +
    `• Qidiruvlar: **${advStats.usage.today.searches}**\n\n` +
    `📆 **Kechagi ko'rsatkichlar:**\n` +
    `• Yangi foydalanuvchilar: **${advStats.growth.newUsersYesterday}**\n` +
    `• Faol foydalanuvchilar: **${advStats.active.yesterday}**\n` +
    `• Video yuklashlar: **${advStats.usage.yesterday.downloadsVideo}**\n` +
    `• Audio yuklashlar: **${advStats.usage.yesterday.downloadsAudio}**\n` +
    `• Qidiruvlar: **${advStats.usage.yesterday.searches}**\n\n` +
    `📈 **Dinamika (Oylik/Haftalik):**\n` +
    `• 7 kunlik faol foydalanuvchilar: **${advStats.active.week}**\n` +
    `• 30 kunlik faol foydalanuvchilar: **${advStats.active.month}**\n` +
    `• Jami foydalanuvchilar: **${advStats.totalUsers}**\n` +
    `• Jami video yuklashlar: **${advStats.stats.totalDownloadsVideo || 0}**\n` +
    `• Jami audio yuklashlar: **${advStats.stats.totalDownloadsAudio || 0}**`;
  
  const kb = new InlineKeyboard().text('🔄 Yangilash', 'adm_refresh_stats');
  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

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

/**
 * Helper to get the currently active sponsor channel based on 2-day rotation logic.
 * Reads channels list from shared channels.json file.
 */
function getActiveSponsorChannel() {
  try {
    const active = sponsorManager.getActiveSponsorChannel();
    if (active) return active;
  } catch (e) {
    console.error('Error reading active sponsor channel:', e.message);
  }

  // Fallback to .env values if channels.json is missing or empty
  const sponsorEnabled = process.env.SPONSOR_CHANNEL_ENABLED === 'true';
  if (!sponsorEnabled) return null;

  let channelUsername = process.env.SPONSOR_CHANNEL_USERNAME;
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
  if (!isValidUsername && process.env.SPONSOR_CHANNEL_LINK) {
    const link = process.env.SPONSOR_CHANNEL_LINK.trim();
    if (link.includes('t.me/')) {
      const parts = link.split('t.me/');
      cleanUsername = '@' + parts[parts.length - 1].split('/')[0].split('?')[0];
    }
  }

  if (cleanUsername && /^@[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return {
      username: cleanUsername,
      link: process.env.SPONSOR_CHANNEL_LINK || `https://t.me/${cleanUsername.replace('@', '')}`
    };
  }

  return null;
}

/**
 * Displays the recent download history for the requesting user.
 */
async function showHistory(ctx) {
  const history = db.getUserDownloads(ctx.from.id);
  if (!history || history.length === 0) {
    return await ctx.reply('📜 Sizning yuklashlar tarixingiz hozircha bo\'sh. Botga biror video yoki musiqa havolasini yuboring!');
  }

  let responseText = '📜 <b>Sizning oxirgi yuklagan fayllaringiz:</b>\n\n';
  const keyboard = new InlineKeyboard();

  history.forEach((item, index) => {
    const typeIcon = item.type === 'audio' ? '🎵' : '🎥';
    responseText += `${index + 1}. ${typeIcon} <b>${escapeHTML(item.title)}</b>\n`;
    
    if (item.url) {
      const shortId = Math.random().toString(36).substring(2, 8);
      urlCache.set(shortId, item.url);
      keyboard.text(`${index + 1} 📥`, item.type === 'audio' ? `dl_aud:${shortId}` : `dl_vid:${shortId}`);
    }
  });

  await ctx.reply(responseText, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Initializes and starts the Grammy Telegram bot
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
function startBot(token) {
  return new Promise((resolve, reject) => {
    if (isBotRunning) {
      return resolve(true);
    }

    try {
      botInstance = new Bot(token);

      // Handle Errors
      botInstance.catch((err) => {
        console.error('Telegram Bot Error:', err.message);
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
          const upsertRes = db.upsertUser(ctx.from, referredBy);
          if (upsertRes.isNew && referredBy) {
            try {
              const newUserName = getDisplayName(ctx.from);
              botInstance.api.sendMessage(
                referredBy,
                `🎁 **Yangi taklif!**\n\n` +
                `Do'stingiz **${escapeHTML(newUserName)}** sizning havolangiz orqali botga qo'shildi!\n\n` +
                `💡 *Eslatma: Do'stingiz bot orqali 1 ta fayl (video yoki audio) yuklasa, taklifingiz muvaffaqiyatli hisoblanadi.*`,
                { parse_mode: 'Markdown' }
              ).catch(() => {});
            } catch (e) {}
          }
          db.trackActiveUser(ctx.from.id);
          if (db.isBanned(ctx.from.id)) return; // ignore banned user
        }

        // Bypass for admin commands & membership check callback
        if (ctx.callbackQuery && (ctx.callbackQuery.data === 'chk_sub' || ctx.callbackQuery.data.startsWith('adm_'))) {
          return await next();
        }
        if (ctx.message && ctx.message.text && (
          ctx.message.text.startsWith('/start') ||
          ctx.message.text.startsWith('/help') ||
          ctx.message.text === '❓ Yordam' ||
          ctx.message.text === '📢 Botni Ulashish' ||
          ctx.message.text === '🎁 Do\'stlarni taklif qilish' ||
          ctx.message.text.startsWith('/referal') ||
          ctx.message.text.startsWith('/admin') ||
          ctx.message.text.startsWith('/stats') ||
          ctx.message.text.startsWith('/analytics') ||
          ctx.message.text.startsWith('/user') ||
          ctx.message.text.startsWith('/ban') ||
          ctx.message.text.startsWith('/unban')
        )) {
          return await next();
        }

        const activeChannel = getActiveSponsorChannel();

        if (activeChannel) {
          if (!ctx.from) return await next();
          try {
            const chatMember = await ctx.api.getChatMember(activeChannel.username, ctx.from.id);
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
            if (!isMember) {
              if (ctx.message) {
                userPendingActions.set(ctx.from.id, {
                  type: ctx.message.text ? 'text' : (ctx.message.video ? 'video' : (ctx.message.audio ? 'audio' : (ctx.message.voice ? 'voice' : (ctx.message.document ? 'document' : 'text')))),
                  message: ctx.message
                });
              }

              const keyboard = new InlineKeyboard()
                .url(`📢 ${activeChannel.username} kanaliga a'zo bo'lish`, activeChannel.link)
                .row()
                .text('🔄 A\'zolikni Tekshirish', 'chk_sub');

              return await ctx.reply(
                `⚠️ <b>Botdan foydalanish uchun kanalimizga a'zo bo'ling!</b>\n\n📢 ${escapeHTML(activeChannel.username)}\n\nA'zo bo'lgach, "A'zolikni Tekshirish" tugmasini bosing — bot so'rovingizni darhol bajaradi.`,
                { parse_mode: 'HTML', reply_markup: keyboard }
              );
            }
          } catch (err) {
            warnSponsorCheck(activeChannel.username, err);
          }
        }

        await next();
      });

      const mainKeyboard = new Keyboard()
        .text('🎁 Do\'stlarni taklif qilish')
        .row()
        .text('❓ Yordam')
        .resized();

      // Send Referral Info & Leaderboard
      async function sendReferralInfo(ctx) {
        const userId = ctx.from.id;
        const info = db.getReferralInfo(userId);
        const botUsername = ctx.me ? ctx.me.username : (process.env.DOWNLOADER_BOT_USERNAME || 'savemedia_music_bot');
        const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
        const shareText = encodeURIComponent(`🔥 Eng tezkor Instagram, YouTube, TikTok va Pinterest media yuklovchi bot! Test qilib ko'ring:`);
        const shareUrl = `https://t.me/share/url?url=${refLink}&text=${shareText}`;

        const leaderboard = db.getReferralLeaderboard(10);
        let leaderText = `🏆 **TOP-10 REFERALLAR (REYTING):**\n\n`;
        if (leaderboard.length === 0) {
          leaderText += `*Hali hech kim do'stlarini taklif qilmadi. Birinchi bo'ling!*\n\n`;
        } else {
          leaderboard.forEach((u, idx) => {
            const medal = ['🥇', '🥈', '🥉'][idx] || `${idx + 1}.`;
            const name = escapeHTML(u.first_name || u.username || 'Foydalanuvchi');
            leaderText += `${medal} **${name}** — **${u.refCount} ta** taklif\n`;
          });
          leaderText += `\n`;
        }

        const userRankText = info.rank > 0 ? `🏅 Sizning o'rningiz: **${info.rank}-o'rin**` : `🏅 Siz hali reytingda emassiz`;

        const msgText =
          `${leaderText}` +
          `🎁 **SIZNING REFERAL MA'LUMOTLARINGIZ:**\n\n` +
          `👥 Taklif qilgan do'stlaringiz: **${info.refCount} ta**\n` +
          `${userRankText}\n\n` +
          `🔗 **Sizning shaxsiy referal havolangiz:**\n\`${refLink}\`\n\n` +
          `💡 *Ushbu havolani do'stlaringizga yoki guruhlarga ulashing. Har bir faol taklif uchun reytingingiz oshadi!*`;

        const keyboard = new InlineKeyboard()
          .url('↪️ 🚀 Do\'stlarga ulashish', shareUrl)
          .row()
          .text('🔄 ⚡️ Reytingni yangilash', 'ref_refresh');

        if (ctx.callbackQuery) {
          try { await ctx.answerCallbackQuery({ text: 'Reyting yangilandi!' }); } catch (e) {}
          try { return await ctx.editMessageText(msgText, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) {}
        }

        await ctx.reply(msgText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

      // Start Command
      botInstance.command('start', (ctx) => {
        const text = ctx.message.text.trim();
        let referrerId = null;
        if (text.includes('ref_')) {
          const parts = text.split('ref_');
          if (parts[1]) referrerId = parseInt(parts[1], 10);
        }
        db.upsertUser(ctx.from, referrerId);

        const keyboard = new InlineKeyboard()
          .text('🇺🇿 O\'zbekcha', 'set_lang:uz')
          .text('🇷🇺 Русский', 'set_lang:ru')
          .text('🇬🇧 English', 'set_lang:en');

        ctx.reply('🌐 **Iltimos, tilni tanlang / Пожалуйста, выберите язык / Please select language:**', {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      });

      // Admin commands (/admin, /stats, /analytics, /user, /ban, /unban)
      botInstance.command('admin', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
          return ctx.reply('⚠️ **Siz admin emassiz!**\nAdmin huquqlarini faol qilish uchun Web Admin paneldan Telegram ID-ingizni kiritib saqlang.', { parse_mode: 'Markdown' });
        }

        const advStats = db.getAdvancedStats();
        const kb = new InlineKeyboard()
          .text('📊 Kunlik Analitika', 'adm_stats').text('🔄 Yangilash', 'adm_refresh_stats');

        await ctx.reply(
          `⚙️ **ADMIN PANELI BOSH QARUVI**\n\n` +
          `👋 Xush kelibsiz, Admin!\n\n` +
          `📊 **Hozirgi ko'rsatkichlar:**\n` +
          `• Jami userlar: **${advStats.totalUsers}**\n` +
          `• Bugungi faol userlar: **${advStats.active.today}**\n` +
          `• Bugungi yangi userlar: **${advStats.growth.newUsersToday}**\n\n` +
          `👇 **Mavjud buyruqlar:**\n` +
          `• \`/stats\` - Kunlik va oylik batafsil analitika\n` +
          `• \`/user <id/username>\` - Foydalanuvchini izlash va profilini ko'rish\n` +
          `• \`/ban <id>\` - Foydalanuvchini bloklash\n` +
          `• \`/unban <id>\` - Blokdan chiqarish`,
          { parse_mode: 'Markdown', reply_markup: kb }
        );
      });

      botInstance.command(['stats', 'analytics'], async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
          return ctx.reply('⚠️ Siz admin emassiz!', { parse_mode: 'Markdown' });
        }
        await sendStatsReport(ctx);
      });

      botInstance.command('user', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
        if (!args) {
          return ctx.reply('⚠️ **Foydalanuvchi ID yoki username kiritilmadi.**\nMisol: `/user 12345678` yoki `/user @username`', { parse_mode: 'Markdown' });
        }

        const u = db.findUser(args);
        if (!u) {
          return ctx.reply(`❌ **Foydalanuvchi topilmadi:** \`${args}\``, { parse_mode: 'Markdown' });
        }

        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Noma\'lum';
        const statusStr = u.banned ? '⛔ Bloklangan' : '✅ Faol';
        const banBtnText = u.banned ? '🔓 Blokdan chiqarish' : '⛔ Bloklash';
        const banBtnData = u.banned ? `adm_unban:${u.id}` : `adm_ban:${u.id}`;

        const kb = new InlineKeyboard().text(banBtnText, banBtnData);

        let msg =
          `👤 **FOYDALANUVCHI MA'LUMOTLARI**\n\n` +
          `🆔 ID: \`${u.id}\`\n` +
          `👤 Ismi: **${escapeHTML(name)}**\n` +
          `🔗 Username: ${u.username ? '@' + u.username : 'mavjud emas'}\n` +
          `📅 Qo'shilgan: \`${u.dateJoined ? u.dateJoined.replace('T', ' ').substring(0, 16) : 'noma\'lum'}\`\n` +
          `🕒 Oxirgi faollik: \`${u.lastSeen ? u.lastSeen.replace('T', ' ').substring(0, 16) : 'noma\'lum'}\`\n` +
          `🎁 Taklif qilgan do'stlari: **${u.refCount || 0}**\n` +
          `🚫 Holati: **${statusStr}**`;

        if (u.history && u.history.length > 0) {
          msg += `\n\n📜 **Oxirgi 5 ta yuklamasi:**\n`;
          u.history.forEach((h, i) => {
            msg += `${i + 1}. ${h.type === 'audio' ? '🎵' : '🎥'} ${escapeHTML(h.title || 'Fayl')}\n`;
          });
        }

        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
      });

      botInstance.command('ban', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
        if (!args) return ctx.reply('⚠️ ID yoki username kiriting. Misol: `/ban 12345678`', { parse_mode: 'Markdown' });
        const u = db.findUser(args);
        if (!u) return ctx.reply(`❌ Foydalanuvchi topilmadi: \`${args}\``, { parse_mode: 'Markdown' });
        db.setBanned(u.id, true);
        ctx.reply(`⛔ **Foydalanuvchi bloklandi:** ${u.first_name} (\`${u.id}\`)`, { parse_mode: 'Markdown' });
      });

      botInstance.command('unban', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
        if (!args) return ctx.reply('⚠️ ID yoki username kiriting. Misol: `/unban 12345678`', { parse_mode: 'Markdown' });
        const u = db.findUser(args);
        if (!u) return ctx.reply(`❌ Foydalanuvchi topilmadi: \`${args}\``, { parse_mode: 'Markdown' });
        db.setBanned(u.id, false);
        ctx.reply(`🔓 **Foydalanuvchi blokdan chiqarildi:** ${u.first_name} (\`${u.id}\`)`, { parse_mode: 'Markdown' });
      });

      // Admin Status Command (/status)
      botInstance.command('status', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const os = require('os');
        const memTotal = Math.round(os.totalmem() / (1024 * 1024));
        const memFree = Math.round(os.freemem() / (1024 * 1024));
        const memUsed = memTotal - memFree;
        const uptimeHours = (os.uptime() / 3600).toFixed(1);
        const usersCount = db.getUsers().length;
        const stats = db.getAdvancedStats();

        const msg =
          `🖥 **SERVER VA BOT SALOMATLIGI (${os.hostname()})**\n\n` +
          `⚙️ OS Platformasi: **${os.type()} ${os.arch()}**\n` +
          `⏱ Server Uptime: **${uptimeHours} soat**\n` +
          `💾 RAM Xotira: **${memUsed} MB / ${memTotal} MB**\n` +
          `👥 Jami Foydalanuvchilar: **${usersCount} ta**\n` +
          `⚡️ Bugun Faol: **${stats.active?.today || 0} ta**\n` +
          `📥 Bugungi Yuklamalar: **${(stats.usage?.today?.downloadsVideo || 0) + (stats.usage?.today?.downloadsAudio || 0)} ta**\n\n` +
          `🟢 Bot Servisi: **Onlayn va ishlamoqda**`;

        await ctx.reply(msg, { parse_mode: 'Markdown' });
      });

      // Admin Broadcast Command (/broadcast)
      botInstance.command('broadcast', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const text = ctx.message.text.split(' ').slice(1).join(' ').trim();
        const replyMsg = ctx.message.reply_to_message;

        if (!text && !replyMsg) {
          return ctx.reply(
            `📢 **Telegram Broadcaster Yo'riqnomasi:**\n\n` +
            `1. Istalgan post, rasm yoki videoga **Reply (Javob)** bosing va \`/broadcast\` deb yozing.\n` +
            `2. Yoki matnli reklama uchun: \`/broadcast Assalomu alaykum!...\``,
            { parse_mode: 'Markdown' }
          );
        }

        const users = db.getUsers();
        await ctx.reply(`🚀 Reklama **${users.length} ta** foydalanuvchiga yuborilmoqda...`);

        let sent = 0;
        let failed = 0;

        for (const user of users) {
          try {
            if (replyMsg) {
              await ctx.api.copyMessage(user.id, ctx.chat.id, replyMsg.message_id);
            } else {
              await ctx.api.sendMessage(user.id, text, { parse_mode: 'HTML' });
            }
            sent++;
          } catch (e) {
            failed++;
          }
          await new Promise(r => setTimeout(r, 40));
        }

        await ctx.reply(`✅ **Reklama tarqatildi!**\n\n Muvaffaqiyatli: **${sent}**\n❌ Yetib bormadi: **${failed}**`, { parse_mode: 'Markdown' });
      });

      // Language Command (/lang)
      botInstance.command('lang', async (ctx) => {
        const keyboard = new InlineKeyboard()
          .text('🇺🇿 O\'zbekcha', 'set_lang:uz')
          .text('🇷🇺 Русский', 'set_lang:ru')
          .text('🇬🇧 English', 'set_lang:en');
        await ctx.reply('🌐 **Tilni tanlang / Select Language / Выберите язык:**', { parse_mode: 'Markdown', reply_markup: keyboard });
      });

      // Top Hits / Charts Command (/top, /chart)
      botInstance.command(['top', 'chart'], async (ctx) => {
        const statusMsg = await ctx.reply('🎵 **Top Hit Musiqalar izlanmoqda...**', { parse_mode: 'Markdown' });
        try {
          const results = await downloader.searchMusic('Top Uzbek and World hits 2026', 10);
          if (!results || results.length === 0) {
            return await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ Musiqa charti yuklanmadi.');
          }

          let textMsg = `🔥 **TOP HIT MUSIQALAR (2026 CHART):**\n\n`;
          const keyboard = new InlineKeyboard();

          results.forEach((r, idx) => {
            const searchId = Math.random().toString(36).substring(2, 8);
            urlCache.set(searchId, r.url);
            const medal = ['🥇', '🥈', '🥉'][idx] || `${idx + 1}.`;
            textMsg += `${medal} **${escapeHTML(r.title)}** (${formatDuration(r.duration)})\n`;
            keyboard.text(`${idx + 1} 🎵`, `dl_aud:${searchId}`);
            if ((idx + 1) % 5 === 0) keyboard.row();
          });

          await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
          await ctx.reply(textMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        } catch (err) {
          console.error(err);
          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ Chartni yuklashda xatolik yuz berdi.');
        }
      });

      // Trim Command (/trim <start> <duration>)
      botInstance.command('trim', async (ctx) => {
        const text = ctx.message.text.trim();
        const args = text.split(' ').slice(1);

        const replyMsg = ctx.message.reply_to_message;
        if (!replyMsg || (!replyMsg.audio && !replyMsg.voice && !replyMsg.document)) {
          return ctx.reply(
            `✂️ **Musiqani Qirqish Yo'riqnomasi:**\n\n` +
            `1. Botga yuborilgan har qanday musiqa yoki audio faylga **Reply (Javob)** bosing.\n` +
            `2. Matniga \`/trim <boshlanish> <davomiylik>\` deb yozing.\n\n` +
            `Misol uchun: \`/trim 15 30\` (15-sekunddan boshlab 30 sekund qirqib beradi) yoki \`/trim 0:30 0:45\``,
            { parse_mode: 'Markdown' }
          );
        }

        const parseTimeStr = (s) => {
          if (!s) return 0;
          if (String(s).includes(':')) {
            const p = String(s).split(':');
            return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
          }
          return parseInt(s, 10) || 0;
        };

        const startSec = parseTimeStr(args[0] || '0');
        const durationSec = parseTimeStr(args[1] || '30');

        const audioObj = replyMsg.audio || replyMsg.voice || replyMsg.document;
        const statusMsg = await ctx.reply('✂️ Musiqa qirqilmoqda...');

        try {
          const fileId = Math.random().toString(36).substring(2, 8);
          const downloadedPath = path.join(downloader.tempDir, `trim_in_${fileId}`);
          await downloadTelegramFile(ctx, audioObj.file_id, downloadedPath);

          const trimmedPath = await processor.trimAudio(downloadedPath, `trim_out_${fileId}`, startSec, durationSec);

          await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
          await ctx.replyWithAudio(new InputFile(trimmedPath), {
            caption: `✂️ **Qirqilgan audio:** (${startSec}s - ${startSec + durationSec}s)\n❤️ @${ctx.me.username} orqali tahrirlandi`,
            parse_mode: 'Markdown'
          });

          try {
            if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
            if (fs.existsSync(trimmedPath)) fs.unlinkSync(trimmedPath);
          } catch (e) {}
        } catch (err) {
          console.error('Trim error:', err);
          await ctx.reply(`❌ Qirqishda xatolik: ${escapeHTML(err.message)}`, { parse_mode: 'HTML' });
        }
      });

      // Handle Admin & Quality Callback Queries
      botInstance.on('callback_query:data', async (ctx, next) => {
        const data = ctx.callbackQuery.data;

        if (data.startsWith('dl_vid_q:')) {
          const parts = data.split(':');
          const shortId = parts[1];
          const quality = parts[2] || '720';
          const url = urlCache.get(shortId);
          if (!url) {
            return await ctx.answerCallbackQuery({ text: 'Havola muddati o\'tgan. Qayta yuboring.', show_alert: true });
          }
          await ctx.answerCallbackQuery({ text: `${quality}p sifatda yuklanmoqda...` });
          const statusMsg = await ctx.reply(`📥 Video ${quality}p formatida yuklanmoqda...`);
          try {
            const mediaPath = await downloader.downloadVideo(url, `dl_q_${quality}_${shortId}`, quality);
            const botUsername = ctx.me.username;
            const movieBotUsername = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
            const captionText = `❤️ @${botUsername} orqali (${quality}p) yuklab olindi 🚀\n\n🍿 Yangi kinolar bepul: @${movieBotUsername}`;
            
            await ctx.replyWithVideo(new InputFile(mediaPath), {
              caption: captionText,
              supports_streaming: true
            });
            db.trackDownload('video');
            db.trackUserDownload(ctx.from.id, `Video ${quality}p`, 'video', url);
            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
            try {
              if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
            } catch (e) {}
          } catch (err) {
            try {
              await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, formatDownloadError(err), { parse_mode: 'HTML' });
            } catch (e) {}
          }
          return;
        }
        if (data.startsWith('video_note:')) {
          const shortId = data.split(':')[1];
          let mediaPath = localVideoCache.get(shortId);
          const url = urlCache.get(shortId);

          await ctx.answerCallbackQuery({ text: '⏺ Dumaloq videoga aylantirilmoqda...' });
          const statusMsg = await ctx.reply('⏺ **Video 1:1 Dumaloq xabarga aylantirilmoqda...**', { parse_mode: 'Markdown' });

          let tempDlPath = null;
          try {
            if (!mediaPath || !fs.existsSync(mediaPath)) {
              if (!url) throw new Error('Video fayl muddati o\'tgan.');
              mediaPath = await downloader.downloadVideo(url, `temp_round_${shortId}`);
              tempDlPath = mediaPath;
            }

            const roundPath = await processor.convertToRoundVideo(mediaPath, `round_${shortId}`, 'circular');
            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
            await ctx.replyWithVideoNote(new InputFile(roundPath));

            try {
              if (fs.existsSync(roundPath)) fs.unlinkSync(roundPath);
              if (tempDlPath && fs.existsSync(tempDlPath)) fs.unlinkSync(tempDlPath);
            } catch (e) {}
          } catch (err) {
            console.error(err);
            try { await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Dumaloq video xatolik: ${escapeHTML(err.message)}`); } catch (e) {}
          }
          return;
        }

        if (data.startsWith('compress_vid:')) {
          const shortId = data.split(':')[1];
          let mediaPath = localVideoCache.get(shortId);
          const url = urlCache.get(shortId);

          await ctx.answerCallbackQuery({ text: '🗜 Video siqilmoqda...' });
          const statusMsg = await ctx.reply('🗜 **Video hajmi 50-70% ga siqilmoqda...**', { parse_mode: 'Markdown' });

          let tempDlPath = null;
          try {
            if (!mediaPath || !fs.existsSync(mediaPath)) {
              if (!url) throw new Error('Video fayl muddati o\'tgan.');
              mediaPath = await downloader.downloadVideo(url, `temp_comp_${shortId}`);
              tempDlPath = mediaPath;
            }

            const compPath = await processor.compressVideo(mediaPath, `comp_${shortId}`);
            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
            await ctx.replyWithVideo(new InputFile(compPath), {
              caption: `🗜 **Video hajmi siqildi!**\n❤️ @${ctx.me.username} orqali siqildi 🚀`,
              supports_streaming: true
            });

            try {
              if (fs.existsSync(compPath)) fs.unlinkSync(compPath);
              if (tempDlPath && fs.existsSync(tempDlPath)) fs.unlinkSync(tempDlPath);
            } catch (e) {}
          } catch (err) {
            console.error(err);
            try { await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Siqishda xatolik: ${escapeHTML(err.message)}`); } catch (e) {}
          }
          return;
        }

        if (data.startsWith('convert_gif:')) {
          const shortId = data.split(':')[1];
          let mediaPath = localVideoCache.get(shortId);
          const url = urlCache.get(shortId);

          await ctx.answerCallbackQuery({ text: '🎞 GIF yaratilmoqda...' });
          const statusMsg = await ctx.reply('🎞 **Videodan GIF animatsiya yaratilmoqda...**', { parse_mode: 'Markdown' });

          let tempDlPath = null;
          try {
            if (!mediaPath || !fs.existsSync(mediaPath)) {
              if (!url) throw new Error('Video fayl muddati o\'tgan.');
              mediaPath = await downloader.downloadVideo(url, `temp_gif_${shortId}`);
              tempDlPath = mediaPath;
            }

            const gifPath = await processor.convertToGif(mediaPath, `gif_${shortId}`);
            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
            await ctx.replyWithAnimation(new InputFile(gifPath), {
              caption: `🎞 **Animatsiyali GIF**\n❤️ @${ctx.me.username} orqali yaratildi 🚀`
            });

            try {
              if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
              if (tempDlPath && fs.existsSync(tempDlPath)) fs.unlinkSync(tempDlPath);
            } catch (e) {}
          } catch (err) {
            console.error(err);
            try { await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ GIF xatolik: ${escapeHTML(err.message)}`); } catch (e) {}
          }
          return;
        }

        if (data === 'adm_stats' || data === 'adm_refresh_stats') {
          if (!isAdmin(ctx.from.id)) {
            return await ctx.answerCallbackQuery({ text: 'Siz admin emassiz!', show_alert: true });
          }
          await ctx.answerCallbackQuery({ text: 'Analitika yangilandi' });
          return await sendStatsReport(ctx);
        }

        if (data === 'ref_refresh') {
          return await sendReferralInfo(ctx);
        }

        if (data.startsWith('adm_ban:')) {
          if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Siz admin emassiz!', show_alert: true });
          const targetId = data.split(':')[1];
          db.setBanned(targetId, true);
          await ctx.answerCallbackQuery({ text: 'Foydalanuvchi bloklandi!' });
          return await ctx.editMessageText(`⛔ **Foydalanuvchi (${targetId}) bloklandi!**`, { parse_mode: 'Markdown' });
        }

        if (data.startsWith('adm_unban:')) {
          if (!isAdmin(ctx.from.id)) return await ctx.answerCallbackQuery({ text: 'Siz admin emassiz!', show_alert: true });
          const targetId = data.split(':')[1];
          db.setBanned(targetId, false);
          await ctx.answerCallbackQuery({ text: 'Foydalanuvchi blokdan chiqarildi!' });
          return await ctx.editMessageText(`🔓 **Foydalanuvchi (${targetId}) blokdan chiqarildi!**`, { parse_mode: 'Markdown' });
        }

        await next();
      });

      // Referral / contest command
      botInstance.command(['referal', 'leaderboard', 'topref'], async (ctx) => {
        await sendReferralInfo(ctx);
      });

      // Help Command
      botInstance.command('help', (ctx) => {
        ctx.reply(
          `❓ **Yordam bo'limi:**\n\n` +
          `• Havola yuboring (YouTube, TikTok, Instagram) -> Men sizga yuklab olish tugmalarini taqdim etaman.\n` +
          `• Video yuboring -> Dumaloq video qilish yoki MP3 ajratish variantlarini olasiz.\n` +
          `• Musiqa (Audio/Voice) yuboring -> Effekt berish va musiqani aniqlash variantlarini olasiz.`,
          { parse_mode: 'Markdown', reply_markup: mainKeyboard }
        );
      });

      // History Command
      botInstance.command('history', async (ctx) => {
        await showHistory(ctx);
      });

      // Inline Query handler (YouTube music search)
      botInstance.on('inline_query', async (ctx) => {
        const query = ctx.inlineQuery.query.trim();
        if (!query) return await ctx.answerInlineQuery([]);

        try {
          db.trackSearch();
          const results = await downloader.searchMusic(query, 8);
          
          const inlineResults = results.map((r, idx) => {
            const searchId = Math.random().toString(36).substring(2, 8);
            urlCache.set(searchId, r.url);

            const textMsg = `🎵 <b>${escapeHTML(r.title)}</b>\n\n` +
              `Ushbu qo'shiqni quyidagi tugma orqali yuklab olishingiz mumkin:`;

            const keyboard = new InlineKeyboard()
              .text('📥 Qo\'shiqni yuklab olish (MP3)', `dl_aud:${searchId}`);

            return {
              type: 'article',
              id: `inline_${searchId}_${idx}`,
              title: r.title,
              description: `Musiqa • Davomiyligi: ${formatDuration(r.duration)}`,
              input_message_content: {
                message_text: textMsg,
                parse_mode: 'HTML'
              },
              reply_markup: keyboard
            };
          });

          await ctx.answerInlineQuery(inlineResults, {
            cache_time: 300
          });
        } catch (err) {
          console.error('Inline Query Error:', err.message);
          await ctx.answerInlineQuery([]);
        }
      });

/**
 * Formats yt-dlp download errors to provide user-friendly troubleshooting instructions.
 */
function formatDownloadError(err) {
  const errMsg = err.message || '';
  if (errMsg.includes('429') || errMsg.includes('confirm you\'re not a bot') || errMsg.includes('Too Many Requests') || errMsg.includes('Sign in')) {
    return `⚠️ <b>YouTube / Instagram IP cheklovi (HTTP 429: Bot Detection)</b>\n\n` +
           `Ushbu havolani yuklashda server IP chekloviga duch kelindi.\n\n` +
           `💡 <b>Muammoni hal qilish yo'li:</b>\n` +
           `• Server loyiha papkasiga <code>cookies.txt</code> faylini joylashtiring.\n` +
           `• Yoki bir ozdan so'ng qayta urinib ko'ring.`;
  }
  return `❌ <b>Yuklashda xatolik yuz berdi:</b>\n${escapeHTML(errMsg.substring(0, 180))}`;
}

      // Listen for text (links and search queries)
      botInstance.on('message:text', async (ctx) => {
        const text = ctx.message.text.trim();

        // Ignore numeric movie codes so Movie Bot handles them without conflict
        if (/^\d{1,6}$/.test(text)) return;

        if (text.includes('Do\'stlarni taklif qilish') || text.includes('Referal')) {
          return await sendReferralInfo(ctx);
        }

        if (text.includes('Yuklashlar Tarixi') || text.includes('Tarixi')) {
          return await showHistory(ctx);
        }

        if (text.includes('Botni Ulashish') || text.includes('Ulashish')) {
          const botUsername = ctx.me.username;
          const shareText = encodeURIComponent(`Eng tezkor video va musiqa yuklovchi bot! 🚀`);
          const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`;
          const keyboard = new InlineKeyboard().url('↪️ 🚀 Do\'stlarga ulashish', shareUrl);
          
          return await ctx.reply('🤖 **Botni do\'stlaringizga tavsiya qiling va ulashing!**', {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }

        if (text.includes('Yordam')) {
          return await ctx.reply(
            `❓ **Yordam bo'limi:**\n\n` +
            `• Havola yuboring (YouTube, TikTok, Instagram) -> Men sizga yuklab olish tugmalarini taqdim etaman.\n` +
            `• Video yuboring -> Dumaloq video qilish yoki MP3 ajratish variantlarini olasiz.\n` +
            `• Musiqa (Audio/Voice) yuboring -> Effekt berish va musiqani aniqlash variantlarini olasiz.`,
            { parse_mode: 'Markdown' }
          );
        }
        
        const urlRegex = /https?:\/\/[^\s]+/;
        if (urlRegex.test(text)) {
          // Direct URL Download
          const url = text.match(urlRegex)[0];
          const shortId = Math.random().toString(36).substring(2, 8);
          urlCache.set(shortId, url);

          const botUsername = ctx.me.username;
          const movieBotUsername = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
          const captionText = `❤️ @${botUsername} orqali yuklab olindi 🚀\n\n🍿 Yangi kinolar bepul: @${movieBotUsername}`;
          
          const shareText = encodeURIComponent(`Eng tezkor video va musiqa yuklovchi bot! 🚀`);
          const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`;
          
          const keyboard = new InlineKeyboard()
            .text('🎧 ⚡️ MP3 Musiqa', `dl_aud:${shortId}`)
            .text('🌀 🎥 Dumaloq Video', `video_note:${shortId}`)
            .row()
            .text('🗜 ⚡️ Hajmini siqish (50-70%)', `compress_vid:${shortId}`)
            .text('🎞 ✨ GIF Animatsiya', `convert_gif:${shortId}`)
            .row()
            .url('↪️ 🚀 Do\'stlarga ulashish', shareUrl)
            .row()
            .url('👉 👥 Guruhga qo\'shish ⤴️', `https://t.me/${botUsername}?startgroup=true`);

          const isGroup = ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup');
          const replyOptions = isGroup ? { reply_to_message_id: ctx.message.message_id } : {};

          // 1. Check Instant Cache (0.1s speed)
          const cached = db.getMediaCache(url);
          if (cached) {
            const instantCaption = `❤️ @${botUsername} orqali (Instant ⚡) yuklab olindi 🚀\n\n🍿 Yangi kinolar bepul: @${movieBotUsername}`;
            try {
              if (cached.type === 'video') {
                await ctx.replyWithVideo(cached.fileId, {
                  caption: instantCaption,
                  reply_markup: keyboard,
                  supports_streaming: true,
                  ...replyOptions
                });
                db.trackDownload('video');
                db.trackUserDownload(ctx.from.id, `Video (Instant ⚡)`, 'video', url);
                return;
              } else if (cached.type === 'photo') {
                await ctx.replyWithPhoto(cached.fileId, {
                  caption: instantCaption,
                  reply_markup: keyboard,
                  ...replyOptions
                });
                db.trackDownload('video');
                db.trackUserDownload(ctx.from.id, `Rasm (Instant ⚡)`, 'photo', url);
                return;
              } else if (cached.type === 'carousel') {
                const mediaGroup = cached.fileIds.map((id, idx) => ({
                  type: 'photo',
                  media: id,
                  caption: idx === 0 ? instantCaption : undefined
                }));
                await ctx.replyWithMediaGroup(mediaGroup, replyOptions);
                await ctx.reply('✨ Barcha rasmlar yuklab olindi!', { reply_markup: keyboard });
                db.trackDownload('video');
                db.trackUserDownload(ctx.from.id, `Rasm Karusel (Instant ⚡)`, 'photo', url);
                return;
              }
            } catch (cacheErr) {
              // Fallback to normal download if Telegram cached fileId expired
            }
          }

          // 2. Normal Download
          const statusMsg = await ctx.reply('📥 Havola tahlil qilinib, yuklab olinmoqda...', replyOptions);

          try {
            const mediaResult = await downloader.downloadVideo(url, `dl_inst_${shortId}`);
            const mediaPaths = Array.isArray(mediaResult) ? mediaResult : [mediaResult];

            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

            if (mediaPaths.length === 1) {
              const mediaPath = mediaPaths[0];
              const ext = path.extname(mediaPath).toLowerCase();
              const isVideo = ['.mp4', '.webm', '.mkv', '.mov', '.avi'].includes(ext);
              const isPhoto = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

              if (isVideo) {
                const sentMsg = await ctx.replyWithVideo(new InputFile(mediaPath), {
                  caption: captionText,
                  reply_markup: keyboard,
                  supports_streaming: true,
                  ...replyOptions
                });
                if (sentMsg && sentMsg.video) {
                  db.setMediaCache(url, { type: 'video', fileId: sentMsg.video.file_id });
                }
                db.trackDownload('video');
                db.trackUserDownload(ctx.from.id, `Video (havola)`, 'video', url);

                // Cache the downloaded video for 5 minutes for instant audio/round video extraction
                localVideoCache.set(shortId, mediaPath);
                setTimeout(() => {
                  try {
                    if (fs.existsSync(mediaPath)) {
                      fs.unlinkSync(mediaPath);
                    }
                    localVideoCache.delete(shortId);
                  } catch (e) {}
                }, 5 * 60 * 1000);

              } else if (isPhoto) {
                const sentMsg = await ctx.replyWithPhoto(new InputFile(mediaPath), {
                  caption: captionText,
                  reply_markup: keyboard,
                  ...replyOptions
                });
                if (sentMsg && sentMsg.photo && sentMsg.photo.length > 0) {
                  db.setMediaCache(url, { type: 'photo', fileId: sentMsg.photo[sentMsg.photo.length - 1].file_id });
                }
                db.trackDownload('video');
                db.trackUserDownload(ctx.from.id, `Rasm (havola)`, 'photo', url);
                try { fs.unlinkSync(mediaPath); } catch (e) {}
              } else {
                // Document fallback
                await ctx.replyWithDocument(new InputFile(mediaPath), {
                  caption: captionText,
                  reply_markup: keyboard,
                  ...replyOptions
                });
                db.trackDownload('video');
                db.trackUserDownload(ctx.from.id, `Hujjat (havola)`, 'document', url);
                try { fs.unlinkSync(mediaPath); } catch (e) {}
              }
            } else if (mediaPaths.length > 1) {
              // Instagram photo carousel (Multiple photos)
              const chunkSize = 10;
              let savedFileIds = [];
              for (let i = 0; i < mediaPaths.length; i += chunkSize) {
                const chunk = mediaPaths.slice(i, i + chunkSize);
                const mediaGroup = chunk.map((p, idx) => ({
                  type: 'photo',
                  media: new InputFile(p),
                  caption: (i === 0 && idx === 0) ? captionText : undefined
                }));
                const sentGroup = await ctx.replyWithMediaGroup(mediaGroup, replyOptions);
                if (Array.isArray(sentGroup)) {
                  sentGroup.forEach(m => {
                    if (m.photo && m.photo.length > 0) {
                      savedFileIds.push(m.photo[m.photo.length - 1].file_id);
                    }
                  });
                }
              }
              if (savedFileIds.length > 0) {
                db.setMediaCache(url, { type: 'carousel', fileIds: savedFileIds });
              }

              // Send action keyboard at the end
              await ctx.reply('✨ Barcha rasmlar yuklab olindi!', {
                reply_markup: keyboard,
                ...replyOptions
              });

              db.trackDownload('video');
              db.trackUserDownload(ctx.from.id, `Rasm Karusel (${mediaPaths.length} ta)`, 'photo', url);

              for (const p of mediaPaths) {
                try { fs.unlinkSync(p); } catch (e) {}
              }
            }
          } catch (err) {
            console.error(err);
            try {
              await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                formatDownloadError(err),
                { parse_mode: 'HTML' }
              );
            } catch (e) {
              await ctx.reply(formatDownloadError(err), { parse_mode: 'HTML' });
            }
          }
        } else {
          // Text Search Query
          const statusMsg = await ctx.reply('🔍 Qidirilmoqda...');
          try {
            db.trackSearch();
            const results = await downloader.searchMusic(text, 10);
            if (!results || results.length === 0) {
              return ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ Hech narsa topilmadi.');
            }

            const shortId = Math.random().toString(36).substring(2, 8);
            searchCache.set(shortId, results);

            let textMsg = `🔍 <b>${escapeHTML(text)}</b>\n\n`;
            results.forEach((r, idx) => {
              textMsg += `${idx + 1}. <b>${escapeHTML(r.title)}</b> ${formatDuration(r.duration)}\n`;
            });

            const keyboard = new InlineKeyboard();
            
            // First row (1-5)
            for (let i = 0; i < Math.min(5, results.length); i++) {
              keyboard.text(`${i + 1}`, `src_dl:${shortId}:${i}`);
            }
            keyboard.row();
            
            // Second row (6-10)
            if (results.length > 5) {
              for (let i = 5; i < results.length; i++) {
                keyboard.text(`${i + 1}`, `src_dl:${shortId}:${i}`);
              }
              keyboard.row();
            }
            
            // Third row (Close)
            keyboard.text('❌', `src_close:${shortId}`);

            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
            await ctx.reply(textMsg, {
              parse_mode: 'HTML',
              reply_markup: keyboard
            });
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(
              ctx.chat.id,
              statusMsg.message_id,
              formatDownloadError(err),
              { parse_mode: 'HTML' }
            );
          }
        }
      });

      // Listen for videos
      botInstance.on('message:video', async (ctx) => {
        const fileId = ctx.message.video.file_id;
        const duration = ctx.message.video.duration || 0;

        const shortFileId = Math.random().toString(36).substring(2, 8);
        fileCache.set(shortFileId, fileId);

        const keyboard = new InlineKeyboard()
          .text('🌀 Dumaloq Video qilish (Teleskop 1:1)', `vid_round_square:${shortFileId}:${duration}`)
          .row()
          .text('🌀 Dumaloq Video (Qora burchaklar bilan)', `vid_round_circle:${shortFileId}:${duration}`)
          .row()
          .text('🎵 MP3 Ovozini ajratish', `vid_extract:${shortFileId}`)
          .row()
          .text('📉 MB Hajmini Kichraytirish (Compress)', `vid_compress:${shortFileId}`);

        await ctx.reply('📥 Video qabul qilindi. Nima qilishni xohlaysiz?', { reply_markup: keyboard });
      });

      botInstance.on('message:document', async (ctx) => {
        const mime = ctx.message.document.mime_type || '';
        const fileId = ctx.message.document.file_id;

        const shortFileId = Math.random().toString(36).substring(2, 8);
        fileCache.set(shortFileId, fileId);

        if (mime.startsWith('video/')) {
          const keyboard = new InlineKeyboard()
            .text('🌀 Dumaloq Video (Teleskop 1:1)', `vid_round_square:${shortFileId}:0`)
            .row()
            .text('🌀 Dumaloq Video (Qora burchaklar)', `vid_round_circle:${shortFileId}:0`)
            .row()
            .text('🎵 MP3 Ovozini ajratish', `vid_extract:${shortFileId}`)
            .row()
            .text('📉 MB Hajmini Kichraytirish (Compress)', `vid_compress:${shortFileId}`);
          return ctx.reply('📥 Video hujjati qabul qilindi. Tanlang:', { reply_markup: keyboard });
        } else if (mime.startsWith('audio/') || mime.includes('mpeg') || mime.includes('mp3') || mime.includes('wav')) {
          const keyboard = new InlineKeyboard()
            .text('🌀 Dumaloq Video Qilish (Video Note)', `aud_to_round:${shortFileId}`)
            .row()
            .text('🎨 Visualizer Video qilish', `aud_visualizer:${shortFileId}`)
            .row()
            .text('⚡️ 1.25x Tezlatish', `aud_speed:${shortFileId}:1.25`)
            .text('🌌 0.75x Sekinlatish', `aud_speed:${shortFileId}:0.75`)
            .row()
            .text('📉 MB Kichraytirish (96kbps)', `aud_compress:${shortFileId}`)
            .row()
            .text('🎹 Musiqa Effektlari (FX)', `aud_effects:${shortFileId}`)
            .row()
            .text('🔍 Musiqani aniqlash (Shazam)', `aud_identify:${shortFileId}`);
          return ctx.reply('📥 Musiqa hujjati qabul qilindi. Tanlang:', { reply_markup: keyboard });
        }
        
        ctx.reply('⚠️ Bot faqat video va musiqa fayllarini qayta ishlay oladi.');
      });

      // Listen for audio and voice
      botInstance.on(['message:audio', 'message:voice'], async (ctx) => {
        const fileId = ctx.message.audio ? ctx.message.audio.file_id : ctx.message.voice.file_id;
        
        const shortFileId = Math.random().toString(36).substring(2, 8);
        fileCache.set(shortFileId, fileId);

        const keyboard = new InlineKeyboard()
          .text('🌀 Dumaloq Video Qilish (Video Note)', `aud_to_round:${shortFileId}`)
          .row()
          .text('🎨 Visualizer Video qilish', `aud_visualizer:${shortFileId}`)
          .row()
          .text('⚡️ 1.25x Tezlatish', `aud_speed:${shortFileId}:1.25`)
          .text('🌌 0.75x Sekinlatish', `aud_speed:${shortFileId}:0.75`)
          .row()
          .text('📉 MB Kichraytirish (96kbps)', `aud_compress:${shortFileId}`)
          .row()
          .text('🎹 Musiqa Effektlari (FX)', `aud_effects:${shortFileId}`)
          .row()
          .text('🔍 Musiqani aniqlash (Shazam)', `aud_identify:${shortFileId}`);

        await ctx.reply('📥 Musiqa/Ovoz qabul qilindi. Nima qilishni xohlaysiz?', { reply_markup: keyboard });
      });

      // Handle callback queries
      botInstance.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        const [action, param1, param2] = data.split(':');

        await ctx.answerCallbackQuery().catch(() => {});

        // Sponsor Check
        if (action === 'chk_sub') {
          const activeChannel = getActiveSponsorChannel();
          if (!activeChannel) {
            // No sponsor channel configured, allow access
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
                // Re-inject the pending message into context and call next
                ctx.message = pending.message;
                return await next();
              } else {
                await ctx.reply('✅ A\'zoligingiz tasdiqlandi! Endi havolani, video yoki audio faylni yuboring.');
              }
            } else {
              await ctx.answerCallbackQuery({
                text: '❌ Siz hali kanalga a\'zo bo\'lmadingiz. Iltimos a\'zo bo\'ling.',
                show_alert: true
              });
            }
          } catch (err) {
            console.error('Sponsor check callback error:', err.message);
            try { await ctx.deleteMessage(); } catch (e) {}
            const pending = userPendingActions.get(ctx.from.id);
            if (pending) {
              userPendingActions.delete(ctx.from.id);
              await ctx.reply('✅ Obunangiz tasdiqlandi! Havolani qayta yuboring.');
              return;
            }
          }
          return;
        }

        // 1. Download Video (Link)
        if (action === 'dl_vid') {
          const url = urlCache.get(param1);
          if (!url) return ctx.reply('❌ Kechirasiz, havola muddati tugagan. Iltimos havolani qayta yuboring.');

          const waitMsg = await ctx.reply('📥 Video yuklab olinmoqda, iltimos kuting... (Katta videolar biroz vaqt olishi mumkin)');
          const outputName = `dl_${param1}`;
          
          try {
            const videoPath = await downloader.downloadVideo(url, outputName);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Video Telegramga yuklanmoqda...');
            await ctx.replyWithVideo(new InputFile(videoPath), { supports_streaming: true });
            db.trackDownload('video');
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            fs.unlinkSync(videoPath); // Cleanup
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Yuklab olishda xatolik yuz berdi: ${err.message.substring(0, 100)}`);
          }
        }

        // 2. Download Audio (Link)
        if (action === 'dl_aud') {
          const shortId = param1;
          const url = urlCache.get(shortId);
          if (!url) return ctx.reply('❌ Kechirasiz, havola muddati tugagan. Iltimos havolani qayta yuboring.');

          const waitMsg = await ctx.reply('🔍 Musiqa tahlil qilinmoqda, iltimos kuting...');
          const outputName = `dl_${shortId}`;

          try {
            let audioPath;
            let videoPath = localVideoCache.get(shortId);
            
            // If cached video has expired, download it temporarily to run search and extraction
            let tempVideoDownloaded = false;
            let isAlreadyAudio = false;
            if (!videoPath || !fs.existsSync(videoPath)) {
              await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📥 Musiqa tahlil qilinmoqda (ovoz yuklanmoqda)...');
              // Download only the audio track of the url (extremely fast, tiny size)
              videoPath = await downloader.downloadAudio(url, `dl_tmp_${shortId}`);
              tempVideoDownloaded = true;
              isAlreadyAudio = true;
            }

            // Perform song identification
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ Musiqa aniqlanmoqda...');
            const song = await identifyMusicFromPath(videoPath);

            if (song) {
              const fullTitle = song.title;
              const fullArtist = song.artist;
              await ctx.api.editMessageText(
                ctx.chat.id, 
                waitMsg.message_id, 
                `🔍 Musiqa aniqlandi: <b>${escapeHTML(fullArtist)} - ${escapeHTML(fullTitle)}</b>\n\n🪐 Variantlar qidirilmoqda...`,
                { parse_mode: 'HTML' }
              );

              try {
                // Search for the identified track's variants on YouTube
                const results = await downloader.searchMusic(`${fullArtist} ${fullTitle}`, 10);
                if (results && results.length > 0) {
                  const searchId = Math.random().toString(36).substring(2, 8);
                  searchCache.set(searchId, results);

                  let textMsg = `🔍 <b>${escapeHTML(fullArtist)} - ${escapeHTML(fullTitle)}</b>\n\nQuyidagi versiyalardan birini tanlang:\n\n`;
                  results.forEach((r, idx) => {
                    textMsg += `${idx + 1}. <b>${escapeHTML(r.title)}</b> ${formatDuration(r.duration)}\n`;
                  });

                  const keyboard = new InlineKeyboard();
                  
                  // First row (1-5)
                  for (let i = 0; i < Math.min(5, results.length); i++) {
                    keyboard.text(`${i + 1}`, `src_dl:${searchId}:${i}`);
                  }
                  keyboard.row();
                  
                  // Second row (6-10)
                  if (results.length > 5) {
                    for (let i = 5; i < results.length; i++) {
                      keyboard.text(`${i + 1}`, `src_dl:${searchId}:${i}`);
                    }
                    keyboard.row();
                  }
                  
                  // Third row (Close)
                  keyboard.text('❌ Yopish', `src_close:${searchId}`);

                  await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
                  await ctx.reply(textMsg, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                  });

                  // Cleanup temporary audio file
                  if (tempVideoDownloaded && fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                  }
                  return; // Exit here. User will make selection from the keyboard.
                }
              } catch (searchErr) {
                console.warn('YouTube search failed, falling back to local audio extraction:', searchErr.message);
              }
            }

            // Fallback to local audio extraction
            if (isAlreadyAudio) {
              audioPath = videoPath; // Already downloaded as MP3!
            } else {
              await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ To\'liq musiqa topilmadi. Videodagi ovozning o\'zi ajratilmoqda...');
              audioPath = await processor.extractAudio(videoPath, outputName);
            }

            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Musiqa yuklanmoqda...');
            const botUsername = ctx.me.username;
            const shareText = encodeURIComponent(`Eng tezkor video va musiqa yuklovchi bot! 🚀`);
            const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`;
            const finalTitle = song ? song.title : 'Extracted Audio';
            const finalPerformer = song ? `${song.artist} | VibeConvert` : `VibeConvert (@${botUsername})`;

            await ctx.replyWithAudio(new InputFile(audioPath), {
              title: finalTitle,
              performer: finalPerformer,
              caption: `❤️ @${botUsername} orqali yuklab olindi 🚀`,
              reply_markup: new InlineKeyboard()
                .url('↪️ Do\'stlarga ulashish', shareUrl)
                .row()
                .url('👉 Guruhga Qo\'shish ⤴️', `https://t.me/${botUsername}?startgroup=true`)
            });
            db.trackDownload('audio');
            db.trackUserDownload(ctx.from.id, finalTitle, 'audio', url);

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);

            // Cleanup
            if (isAlreadyAudio) {
              if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            } else {
              if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
              if (tempVideoDownloaded && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
              }
            }
          } catch (err) {
            console.error('Audio extraction error:', err.message);
            const userErrStr = err.message.includes('ovoz') || err.message.includes('audio') || err.message.includes('musiqa')
              ? err.message
              : 'Ushbu videoda musiqa (ovoz) treki mavjud emas.';
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `⚠️ ${userErrStr}`);
          }
        }

        // 2.5 Search Download (from list)
        if (action === 'src_dl') {
          const shortId = param1;
          const idx = parseInt(param2);
          const results = searchCache.get(shortId);
          if (!results || !results[idx]) {
            return ctx.reply('❌ Sessiya muddati o\'tgan yoki musiqa topilmadi. Iltimos qayta qidiring.');
          }

          const song = results[idx];
          const waitMsg = await ctx.reply(`📥 "${song.title}" yuklab olinmoqda...`);
          const outputName = `src_${shortId}_${idx}`;

          try {
            const audioPath = await downloader.downloadAudio(song.url, outputName);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Telegramga yuklanmoqda...');
            
            const botUsername = ctx.me.username;
            const movieBotUsername = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
            const shareText = encodeURIComponent(`Eng tezkor video va musiqa yuklovchi bot! 🚀`);
            const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`;

            await ctx.replyWithAudio(new InputFile(audioPath), {
              title: song.title,
              performer: `VibeConvert (@${botUsername})`,
              caption: `❤️ @${botUsername} orqali yuklab olindi 🚀\n\n🍿 Yangi kinolar bepul: @${movieBotUsername}`,
              reply_markup: new InlineKeyboard()
                .url('↪️ Do\'stlarga ulashish', shareUrl)
                .row()
                .url('👉 Guruhga Qo\'shish ⤴️', `https://t.me/${botUsername}?startgroup=true`)
            });
            db.trackDownload('audio');
            db.trackUserDownload(ctx.from.id, song.title, 'audio', song.url);

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            fs.unlinkSync(audioPath); // Cleanup
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(
              ctx.chat.id,
              waitMsg.message_id,
              formatDownloadError(err),
              { parse_mode: 'HTML' }
            );
          }
        }

        // 2.6 Close search query
        if (action === 'src_close') {
          const shortId = param1;
          searchCache.delete(shortId);
          try {
            await ctx.deleteMessage();
          } catch (e) {}
        }

        // 3. Extract Audio from Uploaded Video
        if (action === 'vid_extract') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos videoni qayta yuboring.');

          const waitMsg = await ctx.reply('🎵 Video yuklab olinib, ovozi ajratilmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp4`);

          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ MP3 formatiga o\'tkazilmoqda...');
            const outPath = await processor.extractAudio(tempInput, `ext_${shortFileId}`);
            
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Musiqa yuborilmoqda...');
            await ctx.replyWithAudio(new InputFile(outPath));
            db.trackDownload('audio');
            
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Xatolik yuz berdi: ${err.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
        }

        // 4. Video Round note (Teleskop)
        if (action === 'vid_round_square' || action === 'vid_round_circle') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos videoni qayta yuboring.');

          const duration = parseInt(param2 || '0');

          if (duration > 65) {
            return ctx.reply('⚠️ Telegram dumaloq videolari maksimal 1 daqiqa bo\'lishi kerak. Iltimos, qisqaroq video yuboring.');
          }

          const style = action === 'vid_round_square' ? 'square' : 'circular';
          const waitMsg = await ctx.reply('🌀 Video yuklab olinib, dumaloq formatga o\'tkazilmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp4`);

          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ FFmpeg orqali video qayta ishlanmoqda (1:1 mask)...');
            const outPath = await processor.convertToRoundVideo(tempInput, `round_${style}_${shortFileId}`, style);

            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Dumaloq video yuborilmoqda...');
            if (style === 'square') {
              // Native round video note
              await ctx.replyWithVideoNote(new InputFile(outPath));
            } else {
              // Styled round MP4 with black borders
              await ctx.replyWithVideo(new InputFile(outPath), { supports_streaming: true });
            }

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Video aylantirishda xatolik: ${err.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
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
          await ctx.answerCallbackQuery({ text: confirmText, show_alert: true });
          try { await ctx.editMessageText(confirmText); } catch (e) {}

          const name = getDisplayName(ctx.from);
          const welcomeMsg = i18n.t(langCode, 'welcome', { name: escapeHTML(name) });
          await ctx.reply(welcomeMsg, { parse_mode: 'Markdown', reply_markup: mainKeyboard });
          return;
        }

        if (data.startsWith('vid_gif:')) {
          const shortFileId = data.split(':')[1];
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, fayl muddati tugagan. Qayta yuboring.');
          const waitMsg = await ctx.reply('🎞 Video GIF shakliga o\'tkazilmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp4`);
          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            const outPath = await processor.convertToGif(tempInput, `gif_${shortFileId}`);
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithAnimation(new InputFile(outPath), {
              caption: `🎞 **Videodan tayyorlangan GIF!**\n❤️ @${ctx.me.username} orqali tayyorlandi`,
              parse_mode: 'Markdown'
            });
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (e) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ GIF tayyorlashda xatolik: ${e.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
          return;
        }

        if (data.startsWith('vid_slowmo:')) {
          const shortFileId = data.split(':')[1];
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, fayl muddati tugagan. Qayta yuboring.');
          const waitMsg = await ctx.reply('🐌 Video 0.5x Slow-Motion rejimiga sekinlashtirilmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp4`);
          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            const outPath = await processor.slowMotionVideo(tempInput, `slowmo_${shortFileId}`, 0.5);
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithVideo(new InputFile(outPath), {
              caption: `🐌 **Slow-Motion (0.5x) Video!**\n❤️ @${ctx.me.username} orqali tayyorlandi`,
              parse_mode: 'Markdown',
              supports_streaming: true
            });
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (e) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Slow-Motion tayyorlashda xatolik: ${e.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
          return;
        }

        // 4.4 Compress Video
        if (action === 'vid_compress') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, fayl muddati tugagan. Qayta yuboring.');

          const waitMsg = await ctx.reply('📉 Video hajmi (MB) 50-70% ga kichraytirilmoqda, iltimos kuting...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp4`);
          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            const outPath = await processor.compressVideo(tempInput, `compressed_${shortFileId}`);
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithVideo(new InputFile(outPath), {
              caption: `📉 **Video hajmi kichraytirildi!**\n❤️ @${ctx.me.username} orqali siqildi`,
              parse_mode: 'Markdown',
              supports_streaming: true
            });
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (e) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Kichraytirishda xatolik: ${e.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
          return;
        }

        // 4.45 Compress Audio
        if (action === 'aud_compress') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, fayl muddati tugagan. Qayta yuboring.');

          const waitMsg = await ctx.reply('📉 Audio hajmi (MB) 96kbps formatga kichraytirilmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp3`);
          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            const outPath = await processor.compressAudio(tempInput, `compressed_${shortFileId}`);
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithAudio(new InputFile(outPath), {
              caption: `📉 **Audio hajmi kichraytirildi! (96kbps)**\n❤️ @${ctx.me.username} orqali siqildi`,
              parse_mode: 'Markdown'
            });
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (e) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Kichraytirishda xatolik: ${e.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
          return;
        }

        // 4.46 Audio Visualizer Video
        if (action === 'aud_visualizer') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, fayl muddati tugagan. Qayta yuboring.');

          const waitMsg = await ctx.reply('🎨 Musiqa uchun Visualizer video (soundwave) yaratilmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp3`);
          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            const outPath = await processor.createAudioVisualizer(tempInput, `vis_${shortFileId}`);
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithVideo(new InputFile(outPath), {
              caption: `🎨 **Visualizer Video tayyor!**\n❤️ @${ctx.me.username} orqali tayyorlandi`,
              parse_mode: 'Markdown',
              supports_streaming: true
            });
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (e) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Visualizer tayyorlashda xatolik: ${e.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
          return;
        }

        // 4.5 Audio to Round Video
        if (action === 'aud_to_round') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos audio faylni qayta yuboring.');

          const waitMsg = await ctx.reply('🌀 Audio yuklanib, Dumaloq Video (Teleskop 1:1) tayyorlanmoqda...');
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp3`);

          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ FFmpeg audio vizualizatsiyasi va 1:1 kvadrat tayyorlanmoqda...');
            const outPath = await processor.convertAudioToRoundVideo(tempInput, `round_aud_${shortFileId}`);

            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Dumaloq video yuborilmoqda...');
            await ctx.replyWithVideoNote(new InputFile(outPath));

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Video aylantirishda xatolik: ${err.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
        }

        // 4.6 Audio Speed
        if (action === 'aud_speed') {
          const shortFileId = param1;
          const factor = parseFloat(param2) || 1.25;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos audio faylni qayta yuboring.');

          const waitMsg = await ctx.reply(`⚡️ Audio tezligi ${factor}x ga o'zgartirilmoqda...`);
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp3`);

          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            const outPath = await processor.changeAudioSpeed(tempInput, `speed_${factor}_${shortFileId}`, factor);

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithAudio(new InputFile(outPath), {
              caption: `⚡️ **Audio tezligi:** ${factor}x\n❤️ @${ctx.me.username} orqali tahrirlandi`,
              parse_mode: 'Markdown'
            });

            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Tezlikni o'zgartirishda xatolik: ${err.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
        }

        // 5. Select audio effects menu
        if (action === 'aud_effects') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos audio faylni qayta yuboring.');

          const keyboard = new InlineKeyboard()
            .text('🏛 Concert Hall (Reverb)', `ae_apply:concert:${shortFileId}`)
            .row()
            .text('🔊 Power Bass Boost', `ae_apply:bass:${shortFileId}`)
            .row()
            .text('⚡️ Nightcore (Tezkor)', `ae_apply:nightcore:${shortFileId}`)
            .row()
            .text('🌌 Slowed & Reverb', `ae_apply:slowed:${shortFileId}`)
            .row()
            .text('🎧 8D Audio (Aylanma)', `ae_apply:8d:${shortFileId}`)
            .row()
            .text('🎙 Karaoke (Minus/Ovoz o\'chirish)', `ae_apply:karaoke:${shortFileId}`)
            .row()
            .text('🎛 3D Auto-Pan', `ae_apply:autopan:${shortFileId}`);
          
          await ctx.reply("🎹 O'zgartirmoqchi bo'lgan effektni tanlang:", { reply_markup: keyboard });
        }

        // 6. Apply chosen audio effect
        if (action === 'ae_apply') {
          const effect = param1;
          const shortFileId = param2;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos audio faylni qayta yuboring.');

          const waitMsg = await ctx.reply(`🎹 Musiqa yuklanib, "${effect.toUpperCase()}" effekti qo'shilmoqda...`);
          const tempInput = path.join(downloader.tempDir, `in_${shortFileId}.mp3`);

          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ FFmpeg audio filterlari qo\'llanilmoqda...');
            const outPath = await processor.applyAudioEffect(tempInput, `fx_${effect}_${shortFileId}`, effect);

            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '📤 Musiqa yuborilmoqda...');
            await ctx.replyWithAudio(new InputFile(outPath), {
              title: `SavedVideo_${effect.toUpperCase()}`,
              performer: 'VibeConvert Bot'
            });
            db.trackDownload('audio');

            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            fs.unlinkSync(tempInput);
            fs.unlinkSync(outPath);
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Effekt qo'shishda xatolik: ${err.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
        }

        // 7. Identify Music
        if (action === 'aud_identify') {
          const shortFileId = param1;
          const fileId = fileCache.get(shortFileId);
          if (!fileId) return ctx.reply('❌ Kechirasiz, yuklash muddati o\'tgan. Iltimos audio faylni qayta yuboring.');

          const waitMsg = await ctx.reply('🔍 Musiqa tahlil qilinmoqda, iltimos kuting...');
          const tempInput = path.join(downloader.tempDir, `id_${shortFileId}.mp3`);

          try {
            await downloadTelegramFile(ctx, fileId, tempInput);
            
            // Step A: Check local metadata tags first
            const localMeta = await getFileMetadata(tempInput);
            if (localMeta) {
              await ctx.api.editMessageText(
                ctx.chat.id, 
                waitMsg.message_id, 
                `🎵 <b>Mahalliy teglar aniqlandi!</b>\n\n📌 Nom: <i>${escapeHTML(localMeta.title)}</i>\n👤 Ijrochi: <i>${escapeHTML(localMeta.artist)}</i>\n💿 Albom: <i>${escapeHTML(localMeta.album)}</i>`, 
                { parse_mode: 'HTML' }
              );
              fs.unlinkSync(tempInput);
              return;
            }

            // Step B: Shazam Recognition
            const apiKey = process.env.SHAZAM_RAPIDAPI_KEY;
            if (!apiKey) {
              await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '❌ Musiqa fayli ichida hech qanday metadata topilmadi va Shazam API kaliti sozlangan emas.');
              fs.unlinkSync(tempInput);
              return;
            }

            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '⚡️ Shazam API uchun snippet kesilmoqda (Mono PCM 44.1kHz)...');
            const rawPcmPath = await processor.generateRawPcmForShazam(tempInput, `pcm_${fileId}`);
            
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '🛰 Shazam bazasidan qidirilmoqda...');
            const match = await queryShazamAPI(rawPcmPath, apiKey);

            if (match) {
              await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
              const captionText = `🔍 <b>Musiqa aniqlandi!</b>\n\n📌 Nomi: <i>${escapeHTML(match.title)}</i>\n👤 Ijrochi: <i>${escapeHTML(match.artist)}</i>\n\n🔗 <a href="${match.shareUrl}">Shazam havolasi</a>`;
              
              if (match.image) {
                await ctx.replyWithPhoto(match.image, {
                  caption: captionText,
                  parse_mode: 'HTML'
                });
              } else {
                await ctx.reply(captionText, { parse_mode: 'HTML' });
              }
            } else {
              await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, '❌ Kechirasiz, bu musiqani aniqlab bo\'lmadi.');
            }

            fs.unlinkSync(tempInput);
            if (fs.existsSync(rawPcmPath)) fs.unlinkSync(rawPcmPath);
          } catch (err) {
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Musiqani aniqlashda xatolik: ${err.message}`);
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          }
        }
      });

      // Start bot polling safely with error catching
      botInstance.start({
        onStart: (botInfo) => {
          console.log(`Telegram Bot @${botInfo.username} started successfully.`);
        }
      }).catch((err) => {
        console.error('Telegram Bot polling encountered an error:', err.message);
        isBotRunning = false;
      });

      isBotRunning = true;
      scheduleAutoBackup();
      resolve(true);
    } catch (err) {
      isBotRunning = false;
      botInstance = null;
      console.error('Failed to start Telegram Bot:', err.message);
      reject(err);
    }
  });
}

function scheduleAutoBackup() {
  setInterval(async () => {
    if (!botInstance) return;
    const adminIdsStr = process.env.ADMIN_IDS || '';
    const adminIds = adminIdsStr.split(',').map(id => Number(id.trim())).filter(Boolean);
    if (adminIds.length === 0) return;

    try {
      const usersPath = path.join(__dirname, 'data', 'users.json');
      const statsPath = path.join(__dirname, 'data', 'stats.json');
      if (!fs.existsSync(usersPath) || !fs.existsSync(statsPath)) return;

      const usersData = fs.readFileSync(usersPath, 'utf8');
      const statsData = fs.readFileSync(statsPath, 'utf8');
      const backupText = `📦 **KUNLIK AVTO-ZAXIRA (DATABASE BACKUP)**\n\n📅 Sana: ${new Date().toISOString().split('T')[0]}\n👥 Jami Foydalanuvchilar: ${db.getUsers().length} ta`;

      for (const adminId of adminIds) {
        await botInstance.api.sendMessage(adminId, backupText, { parse_mode: 'Markdown' }).catch(() => {});
        await botInstance.api.sendDocument(adminId, new InputFile(Buffer.from(usersData), `users_backup_${new Date().toISOString().split('T')[0]}.json`)).catch(() => {});
        await botInstance.api.sendDocument(adminId, new InputFile(Buffer.from(statsData), `stats_backup_${new Date().toISOString().split('T')[0]}.json`)).catch(() => {});
      }
    } catch (err) {
      console.error('Auto Backup Error:', err.message);
    }
  }, 24 * 60 * 60 * 1000);
}

/**
 * Stops the Telegram Bot
 */
async function stopBot() {
  if (!isBotRunning || !botInstance) {
    return true;
  }
  try {
    await botInstance.stop();
    isBotRunning = false;
    botInstance = null;
    console.log('Telegram Bot stopped successfully.');
    return true;
  } catch (err) {
    console.error('Error stopping bot:', err.message);
    return false;
  }
}

/**
 * Returns the current bot status
 */
function getBotStatus() {
  return {
    running: isBotRunning,
    hasToken: !!(process.env.TELEGRAM_BOT_TOKEN)
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
