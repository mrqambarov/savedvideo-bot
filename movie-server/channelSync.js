/**
 * channelSync.js — Feature #9: Hamkor Kino Kanallar Auto-Sync
 * + Feature #8 notifyWatchers helper
 *
 * Telegram kanalga yangi kino post yuborilganda,
 * bot uni avtomatik movie-server/data/movies.json ga qo'shadi.
 * Shuningdek, serial yangilanganida kuzatuv ro'yxatidagi userlarga
 * bildirishnoma yuborish funksiyasi ham shu yerda.
 */

const db = require('./db');
const i18n = require('./i18n');

let botRef = null;

function setBotRef(bot) {
  botRef = bot;
}

// ============================================================
// FEATURE #8 — Notify Watchlist Users on New Episode
// ============================================================

/**
 * Agar serialga yangi qism qo'shilsa, shu serialni kuzatayotgan
 * barcha foydalanuvchilarga Telegram orqali xabar yuboradi.
 *
 * @param {string} movieCode  - Kino kodi
 * @param {number} episodeNum - Yangi qism raqami
 */
async function notifyWatchers(movieCode, episodeNum) {
  if (!botRef) return;
  try {
    const movie = db.getMovieByCode(movieCode);
    if (!movie) return;

    const watchers = db.getWatchersOfMovie(movieCode);
    if (!watchers || watchers.length === 0) return;

    console.log(`[channelSync] Notifying ${watchers.length} watchers for code=${movieCode}, ep=${episodeNum}`);

    for (const userId of watchers) {
      try {
        const userLang = db.getUserLang(userId) || 'uz';
        const msg = i18n.t(userLang, 'watchlist_new_episode', {
          title: movie.title,
          episode: episodeNum,
          code: movieCode
        });
        await botRef.api.sendMessage(userId, msg, { parse_mode: 'Markdown' });
        // Small delay to avoid hitting rate limits
        await new Promise(r => setTimeout(r, 80));
      } catch (e) {
        // User may have blocked the bot — skip silently
      }
    }
  } catch (e) {
    console.error('[channelSync] notifyWatchers error:', e.message);
  }
}

// ============================================================
// FEATURE #9 — Partner Channel Auto-Sync
// ============================================================

/**
 * Extracts movie metadata from a Telegram message object.
 * Uses the caption (yoki matn) dan kino kodini, nomini ajratadi.
 */
function extractMovieFromMessage(msg) {
  const rawText = msg.caption || msg.text || '';
  if (!rawText || rawText.length < 3) return null;

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Code detection
  const codeMatch = rawText.match(/(?:kodi|kod|code|#)\s*[:=-]?\s*(\d{3,6})/i);
  const code = codeMatch ? codeMatch[1] : null;
  if (!code) return null; // Require explicit code in post

  // Title detection
  let title = '';
  for (const l of lines) {
    const tm = l.match(/(?:nomi|title|film nomi|kino nomi)\s*[:=-]\s*(.+)/i);
    if (tm) { title = tm[1].trim(); break; }
  }

  // Fallback: first non-meta line
  if (!title) {
    for (const l of lines) {
      if (/^(?:kodi|kod|sifat|til|janr|tavsif|kanal|reklama|@)/i.test(l)) continue;
      const clean = l.replace(/@\w+/g, '').replace(/https?:\/\/\S+/g, '').trim();
      if (clean.length > 3 && clean.length < 100) { title = clean; break; }
    }
  }

  if (!title) title = `Kino #${code}`;

  // Genre detection
  const genreMatch = rawText.match(/(?:janri?|genre)\s*[:=-]\s*(.+)/i);
  const genre = genreMatch ? genreMatch[1].trim() : 'Tarjima kino';

  // FileId
  const fileId = msg.video?.file_id || msg.document?.file_id || null;

  return { code, title, genre, fileId, description: `${title} — XIT FILM hamkor kanal orqali qo'shildi.` };
}

/**
 * Syncs a single Telegram channel's recent messages into movies.json.
 * Bot must be a member of the channel.
 *
 * @param {string} channelUsername  - e.g. "xitfilm_uz" (without @)
 */
async function syncChannelMessages(channelUsername) {
  if (!botRef) return { synced: 0, error: 'Bot not initialized' };

  const channels = db.getPartnerChannels();
  const ch = channels.find(c => c.username === channelUsername);
  if (!ch) return { synced: 0, error: 'Channel not found in partner list' };

  let synced = 0;
  try {
    const chatId = `@${channelUsername}`;

    // Use getUpdates with chat filter to find recent messages
    // Note: Bot must be admin in channel to read messages via getUpdates
    // Alternative: use forwardMessages if needed
    // For now, this is a placeholder that documents the approach —
    // real sync happens via bot.on('channel_post') listener below.
    console.log(`[channelSync] Manual sync requested for @${channelUsername} (auto-sync via channel_post listener)`);
    return { synced, message: 'Auto-sync is active via channel_post event listener.' };
  } catch (e) {
    console.error(`[channelSync] syncChannelMessages error for @${channelUsername}:`, e.message);
    return { synced, error: e.message };
  }
}

/**
 * Registers the channel_post listener on the bot.
 * Called once during bot initialization.
 *
 * When a partner channel posts a video with a code in the caption,
 * it's automatically saved to movies.json.
 */
function registerChannelPostListener(bot) {
  if (!bot) return;
  setBotRef(bot);

  bot.on('channel_post', async (ctx) => {
    try {
      const post = ctx.channelPost;
      if (!post) return;

      const chat = post.chat;
      const chatTitle = chat?.title || '';
      const chatIdStr = String(chat?.id || '');
      const storageInfo = db.getStorageChannel();

      // 1. Check if this post is from the Private Storage Channel ("Xit Film | Shaxsiy")
      const isStorageChannel =
        (storageInfo.channelId && storageInfo.channelId === chatIdStr) ||
        chatTitle.toLowerCase().includes('shaxsiy') ||
        chatTitle.toLowerCase().includes('xit film | shaxsiy');

      if (isStorageChannel) {
        // Auto-bind storage channel ID if not set or changed
        if (storageInfo.channelId !== chatIdStr) {
          db.setStorageChannel(chatIdStr, chatTitle || 'Xit Film | Shaxsiy');
          console.log(`[channelSync] 🔒 Private Storage Channel connected: "${chatTitle}" (ID: ${chatIdStr})`);
        }

        const rawText = post.caption || post.text || '';
        const fileId = post.video?.file_id || post.document?.file_id || null;
        
        // Match movie code e.g. #kod_1001, Kod: 1001, #1001
        const codeMatch = rawText.match(/(?:#kod_|kodi|kod|code|#)\s*[:=-]?\s*(\d{3,6})/i);
        if (codeMatch && codeMatch[1]) {
          const code = codeMatch[1];
          const isShorts = /#shorts|shorts|treyler|lavha/i.test(rawText);

          if (isShorts) {
            db.updateMovieStorage(code, {
              storageShortsMessageId: post.message_id,
              storageShortsFileId: fileId,
              storageChannelId: chatIdStr
            });
            console.log(`[channelSync] ⚡️ Storage Shorts indexed for #${code} (msg: ${post.message_id})`);
          } else {
            db.updateMovieStorage(code, {
              storageMessageId: post.message_id,
              storageFileId: fileId,
              storageChannelId: chatIdStr
            });
            console.log(`[channelSync] 🎬 Storage Movie indexed for #${code} (msg: ${post.message_id})`);
          }
        }
        return;
      }

      // 2. Otherwise check partner channels
      const chatUsername = post.chat?.username?.toLowerCase();
      if (!chatUsername) return;

      const partners = db.getPartnerChannels();
      const partner = partners.find(p => p.username === chatUsername && p.autoSync);
      if (!partner) return;

      const movieData = extractMovieFromMessage(post);
      if (!movieData) return;

      // Check if code already exists
      const existing = db.getMovieByCode(movieData.code);
      if (existing) {
        console.log(`[channelSync] Code ${movieData.code} already exists, skipping.`);
        return;
      }

      // Save to database
      const saved = db.addMovie({
        code: movieData.code,
        title: movieData.title,
        description: movieData.description,
        genre: movieData.genre,
        fileId: movieData.fileId,
        dateAdded: new Date().toISOString()
      });

      if (saved) {
        console.log(`[channelSync] ✅ New movie synced from @${chatUsername}: "${movieData.title}" (Code: ${movieData.code})`);
        db.updatePartnerChannelSyncId(chatUsername, post.message_id);
      }
    } catch (e) {
      console.error('[channelSync] channel_post handler error:', e.message);
    }
  });

  console.log('[channelSync] ✅ Storage & Partner channel post listener registered.');
}

module.exports = {
  setBotRef,
  notifyWatchers,
  syncChannelMessages,
  registerChannelPostListener
};
