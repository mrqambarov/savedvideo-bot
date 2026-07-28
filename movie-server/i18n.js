const messages = {
  uz: {
    welcome: "👋 **Salom, {name}!**\n\nMen **Kino Note (Film) Bot**man.\n\n🍿 Kino kodini yuboring (masalan: `101`).\n🔍 Kino qidirish uchun tugmani bosing yoki nomini yozing.",
    search_btn: "🔍 Kino Qidirish",
    genre_btn: "🗂 Janrlar",
    req_btn: "🙋‍♂️ Buyurtma berish",
    help_btn: "ℹ️ Yordam",
    lang_btn: "🌐 Tilni o'zgartirish",
    select_lang: "🌐 Iltimos, tilni tanlang:",
    searching: "🔍 Kino nomini kiriting:",
    not_found: "🔍 **Kino topilmadi.**",
    req_success: "✅ **Buyurtmangiz qabul qilindi!**",
    admin_help: "\n\n⚙️ **Admin buyruqlari:**\n• Videoga reply qilib `/add [kod] [nom] | [tavsif] | [janr]` deb yozing."
  },
  ru: {
    welcome: "👋 **Привет, {name}!**\n\nЯ **Kino Note (Film) Bot**.\n\n🍿 Пришлите код фильма (например: `101`).\n🔍 Для поиска нажмите кнопку или напишите название.",
    search_btn: "🔍 Поиск фильма",
    genre_btn: "🗂 Жанры",
    req_btn: "🙋‍♂️ Заказать фильм",
    help_btn: "ℹ️ Помощь",
    lang_btn: "🌐 Сменить язык",
    select_lang: "🌐 Пожалуйста, выберите язык:",
    searching: "🔍 Введите название фильма:",
    not_found: "🔍 **Фильм не найден.**",
    req_success: "✅ **Ваш заказ принят!**",
    admin_help: "\n\n⚙️ **Админ команды:**\n• Ответьте на видео `/add [код] [название] | [описание] | [жанр]`."
  },
  en: {
    welcome: "👋 **Hello, {name}!**\n\nI am the **Movie Note Bot**.\n\n🍿 Send a movie code (e.g., `101`).\n🔍 Click the button to search or type the name.",
    search_btn: "🔍 Search Movie",
    genre_btn: "🗂 Genres",
    req_btn: "🙋‍♂️ Request Movie",
    help_btn: "ℹ️ Help",
    lang_btn: "🌐 Change Language",
    select_lang: "🌐 Please select a language:",
    searching: "🔍 Enter movie title:",
    not_found: "🔍 **Movie not found.**",
    req_success: "✅ **Your request has been accepted!**",
    admin_help: "\n\n⚙️ **Admin commands:**\n• Reply to video with `/add [code] [name] | [desc] | [genre]`."
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
