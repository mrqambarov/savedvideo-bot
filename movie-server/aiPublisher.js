const db = require('./db');

/**
 * AI-assisted metadata and Instagram Reels / TikTok promo caption generator
 */
function generateAiMovieMetadata({ title, customCode, genre }) {
  const code = customCode || Math.floor(1000 + Math.random() * 9000).toString();
  const cleanTitle = (title || 'Noma\'lum Film').trim();
  const selectedGenre = genre || 'Jangari / Triller';

  const descriptions = [
    `Ushbu ajoyib film tomoshabinni ilk daqiqalardanoq o'ziga jalb qiladi. Kutilmagan burilishlar va yuqori sifatli professional tarjima bilan taqdim etiladi.`,
    `Dunyoni larzaga keltirgan eng shov-shuvli premyera! HD va 4K formatda bepul tomosha qiling.`,
    `Tog'lar, sarguzasht va hayajonli voqealarga boy kino. Oilangiz va do'stlaringiz bilan ko'rish uchun ideal tanlov!`,
    `Chuqur ma'noga ega va inson ruhiyatini to'lqinlantiradigan ajoyib kartina. Albatta tomosha qiling!`
  ];

  const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];

  // Generate Instagram Reels / TikTok promo caption
  const botUsername = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
  const botLink = `https://t.me/${botUsername}?start=${code}`;

  const instagramCaption =
    `🎬 FILMNI TOMOSHA QILISH 👇\n\n` +
    `🍿 Nomi: ${cleanTitle}\n` +
    `🗂 Janri: #${selectedGenre.replace(/\s+/g, '_')}\n` +
    `🔑 BOTDAGI KODI: ${code}\n\n` +
    `📌 Ushbu filmni to'liq 4K formatda tomosha qilish uchun Telegram botimizga kiring:\n` +
    `👉 @${botUsername}\n` +
    `🔗 ${botLink}\n\n` +
    `#kino #tarjimakino #kino2026 #uzbekistan #reelsuzb #xitfilm #${cleanTitle.replace(/\s+/g, '_')}`;

  const telegramPostText =
    `🔥 **YANGI PREMYERA BAZAGA QO'SHILDI!** 🔥\n\n` +
    `🎬 **Film nomi:** *${cleanTitle}*\n` +
    `🗂 **Janr:** _${selectedGenre}_\n` +
    `🔑 **Kino kodi:** \`${code}\`\n\n` +
    `📝 _${randomDesc}_\n\n` +
    `👇 **Botda tomosha qilish uchun tugmani bosing:**`;

  return {
    code,
    title: cleanTitle,
    genre: selectedGenre,
    description: randomDesc,
    botLink,
    instagramCaption,
    telegramPostText
  };
}

/**
 * Publishes promo announcement to Telegram channel if configured
 */
async function publishSocialPromo({ code, title, telegramPostText, botInstance }) {
  try {
    const channelUsername = process.env.MOVIE_SPONSOR_CHANNEL_USERNAME || process.env.SPONSOR_CHANNEL_USERNAME;
    if (!channelUsername || !botInstance) {
      return { success: false, reason: 'Sponsor / Promo kanal sozlanmagan' };
    }

    const cleanChannel = channelUsername.startsWith('@') ? channelUsername : '@' + channelUsername;
    const botUsername = process.env.MOVIE_BOT_USERNAME || 'xitfilm_bot';
    
    const { InlineKeyboard } = require('grammy');
    const keyboard = new InlineKeyboard()
      .url('🍿 Kinoni Botda Ko\'rish', `https://t.me/${botUsername}?start=${code}`);

    await botInstance.api.sendMessage(cleanChannel, telegramPostText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    return { success: true, channel: cleanChannel };
  } catch (e) {
    console.error('Error publishing social promo:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Publishes direct post to Instagram account using username and password
 */
async function publishToInstagram({ caption }) {
  try {
    const config = db.getInstagramConfig();
    if (!config.username || !config.password) {
      return { success: false, reason: 'Instagram login va parol kiritilmagan. Sozlamalar bo\'limida saqlang.' };
    }

    const { IgApiClient } = require('instagram-private-api');
    const ig = new IgApiClient();
    ig.state.generateDevice(config.username);

    // Simulate login
    await ig.account.login(config.username, config.password);

    // Sample generated poster image buffer for Instagram feed post
    const sampleJpgBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64'
    );

    // Publish photo to Instagram
    const publishResult = await ig.publish.photo({
      file: sampleJpgBuffer,
      caption: caption
    });

    return { success: true, mediaId: publishResult.media.id, username: config.username };
  } catch (err) {
    console.error('Instagram Auto-Post error:', err.message);
    return { success: false, error: err.message || 'Instagram akkauntga kirishda xatolik! Login/Parolni tekshiring.' };
  }
}

module.exports = {
  generateAiMovieMetadata,
  publishSocialPromo,
  publishToInstagram
};
