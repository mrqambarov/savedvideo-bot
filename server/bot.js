const { Bot, InputFile, InlineKeyboard, Keyboard } = require('grammy');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execFile } = require('child_process');
const downloader = require('./downloader');
const processor = require('./processor');
const db = require('./db');

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

        const isValidUsername = cleanUsername && /^@[a-zA-Z0-9_]+$/.test(cleanUsername);
        if (isValidUsername) {
          return {
            username: cleanUsername,
            link: channel.link || `https://t.me/${cleanUsername.replace('@', '')}`
          };
        }
      }
    }
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
          db.addUser(ctx.from);
          db.trackActiveUser(ctx.from.id);
        }

        // Bypass for membership check callback or start/help commands
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'chk_sub') {
          return await next();
        }
        if (ctx.message && ctx.message.text && (ctx.message.text.startsWith('/start') || ctx.message.text.startsWith('/help') || ctx.message.text === '❓ Yordam' || ctx.message.text === '📢 Botni Ulashish')) {
          return await next();
        }

        const activeChannel = getActiveSponsorChannel();

        if (activeChannel) {
          try {
            const chatMember = await ctx.api.getChatMember(activeChannel.username, ctx.from.id);
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
            if (!isMember) {
              // Save the pending action so we can process it after verification
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

      const mainKeyboard = new Keyboard()
        .text('❓ Yordam')
        .resized();

      // Start Command
      botInstance.command('start', (ctx) => {
        ctx.reply(
          `👋 **Salom, ${ctx.from.first_name || 'foydalanuvchi'}!**\n\n` +
          `Men video va musiqalar bilan ishlovchi botman.\n\n` +
          `⚙️ **Imkoniyatlarim:**\n` +
          `1️⃣ **Link Downloader:** Menga YouTube, Instagram yoki TikTok havolasini yuboring - men uni video yoki MP3 ko'rinishida yuklab beraman.\n` +
          `2️⃣ **Dumaloq Video (Teleskop):** Menga kvadrat yoki ixtiyoriy video yuboring - men uni Telegram dumaloq videosiga (Video Note) aylantiraman.\n` +
          `3️⃣ **Ovozni ajratish:** Videodan MP3 musiqasini ajratib beraman.\n` +
          `4️⃣ **Musiqa effektlari:** Ovoz fayllarini Concert, Bass Boost, Nightcore, Slowed & Reverb, 8D, Karaoke va Auto-Pan formatlariga o'tkazib beraman.\n` +
          `5️⃣ **Musiqani aniqlash:** Noma'lum musiqani yuboring, men uni kim aytganini topib beraman!`,
          { parse_mode: 'Markdown', reply_markup: mainKeyboard }
        );
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
  if (errMsg.includes('429') || errMsg.includes('confirm you\'re not a bot') || errMsg.includes('Too Many Requests')) {
    return `⚠️ <b>YouTube yuklashni chekladi (HTTP 429: Too Many Requests)</b>\n\n` +
           `Ushbu muammoni hal qilish uchun:\n` +
           `1. VPN o'chiring yoki internetingizni o'chirib-yoqing (yangi IP olish uchun).\n` +
           `2. Yoki loyiha papkasiga brauzer kuki faylini (<b>cookies.txt</b>) joylashtiring.`;
  }
  return `❌ <b>Yuklashda xatolik yuz berdi:</b>\n${escapeHTML(errMsg.substring(0, 150))}`;
}

      // Listen for text (links and search queries)
      botInstance.on('message:text', async (ctx) => {
        const text = ctx.message.text.trim();

        if (text === '📜 Yuklashlar Tarixi') {
          return await showHistory(ctx);
        }

        if (text === '📢 Botni Ulashish') {
          const botUsername = ctx.me.username;
          const shareText = encodeURIComponent(`Eng tezkor video va musiqa yuklovchi bot! 🚀`);
          const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`;
          const keyboard = new InlineKeyboard().url('↪️ Do\'stlarga ulashish', shareUrl);
          
          return await ctx.reply('🤖 **Botni do\'stlaringizga tavsiya qiling va ulashing!**', {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }

        if (text === '❓ Yordam') {
          return await ctx.reply(
            `❓ **Yordam bo'limi:**\n\n` +
            `• Havola yuboring (YouTube, TikTok, Instagram) -> Men sizga yuklab olish tugmalarini taqdim etaman.\n` +
            `• Video yuboring -> Dumaloq video qilish yoki MP3 ajratish variantlarini olasiz.\n` +
            `• Musiqa (Audio/Voice) yuboring -> Effekt berish va musiqani aniqlash variantlarini olasiz.`,
            { parse_mode: 'Markdown', reply_markup: mainKeyboard }
          );
        }
        
        const urlRegex = /https?:\/\/[^\s]+/;
        if (urlRegex.test(text)) {
          // Direct URL Download
          const url = text.match(urlRegex)[0];
          const statusMsg = await ctx.reply('📥 Havola tahlil qilinib, yuklab olinmoqda...');

          try {
            const shortId = Math.random().toString(36).substring(2, 8);
            urlCache.set(shortId, url);

            // Download the file instantly
            const mediaPath = await downloader.downloadVideo(url, `dl_inst_${shortId}`);

            const botUsername = ctx.me.username;
            const movieBotUsername = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
            const captionText = `❤️ @${botUsername} orqali yuklab olindi 🚀\n\n🍿 Yangi kinolar bepul: @${movieBotUsername}`;
            
            const shareText = encodeURIComponent(`Eng tezkor video va musiqa yuklovchi bot! 🚀`);
            const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`;
            
            const keyboard = new InlineKeyboard()
              .text('🎵 Qo\'shiqni yuklab olish (MP3)', `dl_aud:${shortId}`)
              .row()
              .url('↪️ Do\'stlarga ulashish', shareUrl)
              .row()
              .url('👉 Guruhga qo\'shish ⤴️', `https://t.me/${botUsername}?startgroup=true`);

            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

            const ext = path.extname(mediaPath).toLowerCase();
            const isVideo = ['.mp4', '.webm', '.mkv', '.mov', '.avi'].includes(ext);
            const isPhoto = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

            if (isVideo) {
              await ctx.replyWithVideo(new InputFile(mediaPath), {
                caption: captionText,
                reply_markup: keyboard
              });
              db.trackDownload('video');
              db.trackUserDownload(ctx.from.id, `Video (havola)`, 'video', url);

              // Cache the downloaded video for 5 minutes for instant audio extraction
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
              await ctx.replyWithPhoto(new InputFile(mediaPath), {
                caption: captionText,
                reply_markup: keyboard
              });
              db.trackDownload('video');
              db.trackUserDownload(ctx.from.id, `Rasm (havola)`, 'photo', url);
              fs.unlinkSync(mediaPath);
            } else {
              // Document fallback
              await ctx.replyWithDocument(new InputFile(mediaPath), {
                caption: captionText,
                reply_markup: keyboard
              });
              db.trackDownload('video');
              db.trackUserDownload(ctx.from.id, `Hujjat (havola)`, 'document', url);
              fs.unlinkSync(mediaPath);
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
          .text('🎵 MP3 Ovozini ajratish', `vid_extract:${shortFileId}`);

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
            .text('🎵 MP3 Ovozini ajratish', `vid_extract:${shortFileId}`);
          return ctx.reply('📥 Video hujjati qabul qilindi. Tanlang:', { reply_markup: keyboard });
        } else if (mime.startsWith('audio/') || mime.includes('mpeg') || mime.includes('mp3') || mime.includes('wav')) {
          const keyboard = new InlineKeyboard()
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
          .text('🎹 Musiqa Effektlari (FX)', `aud_effects:${shortFileId}`)
          .row()
          .text('🔍 Musiqani aniqlash (Shazam)', `aud_identify:${shortFileId}`);

        await ctx.reply('📥 Musiqa qabul qilindi. Nima qilishni xohlaysiz?', { reply_markup: keyboard });
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
              ctx.message = pending.message;
              return await next();
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
            await ctx.replyWithVideo(new InputFile(videoPath));
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
            console.error(err);
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Musiqa ajratishda xatolik: ${err.message.substring(0, 100)}`);
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
              await ctx.replyWithVideo(new InputFile(outPath));
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
      resolve(true);
    } catch (err) {
      isBotRunning = false;
      botInstance = null;
      console.error('Failed to start Telegram Bot:', err.message);
      reject(err);
    }
  });
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
