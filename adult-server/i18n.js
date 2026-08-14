const messages = {
  uz: {
    welcome: "👋 <b>Assalomu alaykum {name} botimizga xush kelibsiz.</b>\n\n✍️ <b>Kino kodini yuboring...</b>",
    help_btn: "❓ Yordam",
    search_btn: "🔍 Video Qidirish",
    genre_btn: "📂 Janrlar",
    req_btn: "📩 Video Buyurtma qilish",
    code_not_found: "❌ <b>Kod: {code}</b> bo'yicha video topilmadi.",
    not_found: "❌ <b>\"{query}\"</b> bo'yicha hech qanday 18+ video topilmadi.",
    order_this_movie: "➕ Ushbu videoni buyurtma qilish"
  },
  ru: {
    welcome: "👋 <b>Привет, {name}!</b>\n\nДобро пожаловать в бот 18+ Видео, Триллеров и Фильмов!\n\n🚀 <b>Использование:</b>\nПришлите код или название видео - я отправлю видео!",
    help_btn: "❓ Помощь",
    search_btn: "🔍 Поиск видео",
    genre_btn: "📂 Жанры",
    req_btn: "📩 Заказать видео",
    code_not_found: "❌ По коду <b>{code}</b> видео не найдено.",
    not_found: "❌ По запросу <b>\"{query}\"</b> ничего не найдено.",
    order_this_movie: "➕ Заказать это видео"
  },
  en: {
    welcome: "👋 <b>Hello, {name}!</b>\n\nWelcome to 18+ Videos, Thrillers & Movies Bot!\n\n🚀 <b>Usage:</b>\nSend a video code or title - I will deliver the video!",
    help_btn: "❓ Help",
    search_btn: "🔍 Search Video",
    genre_btn: "📂 Genres",
    req_btn: "📩 Request Video",
    code_not_found: "❌ Video not found for code <b>{code}</b>.",
    not_found: "❌ No 18+ videos found for <b>\"{query}\"</b>.",
    order_this_movie: "➕ Request this video"
  }
};

function t(lang, key, params = {}) {
  const l = messages[lang] ? lang : 'uz';
  let str = messages[l][key] || messages['uz'][key] || key;
  Object.keys(params).forEach(p => {
    str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
  });
  return str;
}

module.exports = { t };
