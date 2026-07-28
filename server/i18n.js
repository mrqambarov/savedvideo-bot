const messages = {
  uz: {
    welcome: "👋 **Salom, {name}!**\n\nMen video va musiqalar bilan ishlovchi botman.\n\n⚙️ **Imkoniyatlarim:**\n1️⃣ **Link Downloader:** Havolani yuboring - yuklab beraman.\n2️⃣ **Dumaloq Video:** Teleskop videosiga aylantiraman.\n3️⃣ **Ovoz ajratish:** Videodan MP3 ajratib beraman.\n4️⃣ **Effektlar:** Musiqaga 8D, Bass va boshqa effektlar qo'shaman.\n5️⃣ **Shazam:** Musiqani aniqlab beraman!",
    help: "❓ **Yordam:**\n• Havola yuboring -> Yuklash tugmalari\n• Video yuboring -> Teleskop yoki MP3\n• Musiqa yuboring -> Effektlar yoki Shazam",
    history: "📜 **Yuklashlar Tarixi**",
    share: "📢 **Botni Ulashish**",
    help_btn: "❓ Yordam",
    lang_btn: "🌐 Tilni o'zgartirish",
    select_lang: "🌐 Iltimos, tilni tanlang / Пожалуйста, выберите язык / Please select a language:",
    sub_required: "⚠️ **Botdan foydalanish uchun kanalimizga a'zo bo'ling!**",
    sub_check: "🔄 A'zolikni Tekshirish",
    downloading: "📥 Havola tahlil qilinmoqda...",
    uploading: "📤 Telegramga yuklanmoqda...",
    error: "❌ Xatolik yuz berdi.",
    identifying: "🔍 Musiqa tahlil qilinmoqda..."
  },
  ru: {
    welcome: "👋 **Привет, {name}!**\n\nЯ бот для работы с видео и музыкой.\n\n⚙️ **Мои возможности:**\n1️⃣ **Link Downloader:** Пришлите ссылку - я скачаю.\n2️⃣ **Круглое видео:** Сделаю Video Note.\n3️⃣ **Извлечь звук:** Сделаю MP3 из видео.\n4️⃣ **Эффекты:** Добавлю 8D, Bass и др.\n5️⃣ **Shazam:** Определю песню!",
    help: "❓ **Помощь:**\n• Пришлите ссылку -> Кнопки скачивания\n• Пришлите видео -> Круглое видео или MP3\n• Пришлите музыку -> Эффекты или Shazam",
    history: "📜 **История загрузок**",
    share: "📢 **Поделиться ботом**",
    help_btn: "❓ Помощь",
    lang_btn: "🌐 Сменить язык",
    select_lang: "🌐 Пожалуйста, выберите язык:",
    sub_required: "⚠️ **Для использования бота подпишитесь на наш канал!**",
    sub_check: "🔄 Проверить подписку",
    downloading: "📥 Ссылка анализируется...",
    uploading: "📤 Загрузка в Telegram...",
    error: "❌ Произошла ошибка.",
    identifying: "🔍 Анализ музыки..."
  },
  en: {
    welcome: "👋 **Hello, {name}!**\n\nI'm a video and music downloader bot.\n\n⚙️ **Features:**\n1️⃣ **Link Downloader:** Send a link - I'll download it.\n2️⃣ **Round Video:** Convert to Video Note.\n3️⃣ **Extract Audio:** Get MP3 from video.\n4️⃣ **Effects:** Add 8D, Bass, and more.\n5️⃣ **Shazam:** Identify music!",
    help: "❓ **Help:**\n• Send link -> Download buttons\n• Send video -> Round video or MP3\n• Send music -> Effects or Shazam",
    history: "📜 **Download History**",
    share: "📢 **Share Bot**",
    help_btn: "❓ Help",
    lang_btn: "🌐 Change Language",
    select_lang: "🌐 Please select a language:",
    sub_required: "⚠️ **Please subscribe to our channel to use the bot!**",
    sub_check: "🔄 Verify Subscription",
    downloading: "📥 Analyzing link...",
    uploading: "📤 Uploading to Telegram...",
    error: "❌ An error occurred.",
    identifying: "🔍 Identifying music..."
  }
};

function t(lang, key, params = {}) {
  let text = messages[lang] && messages[lang][key] ? messages[lang][key] : (messages['uz'][key] || key);
  Object.keys(params).forEach(p => {
    text = text.replace(`{${p}}`, params[p]);
  });
  return text;
}

module.exports = { t };
