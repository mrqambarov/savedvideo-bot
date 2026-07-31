const messages = {
  uz: {
    welcome: "👋 **Salom, {name}!**\n\nMen **Xit Film (Kino) Bot**man.\n\n🍿 Kino kodini yuboring (masalan: `1001`).\n🔍 Kino qidirish uchun nomini yozing yoki pastdagi menyudan foydalaning.",
    search_btn: "🔍 Kino Qidirish",
    genre_btn: "🗂 Janrlar",
    req_btn: "🙋‍♂️ Buyurtma berish",
    help_btn: "ℹ️ Yordam",
    lang_btn: "🌐 Tilni o'zgartirish",
    select_lang: "🌐 **Iltimos, tilni tanlang / Пожалуйста, выберите язык / Please select language:**",
    lang_changed: "✅ Til O'zbekchaga o'zgartirildi!",
    searching: "🔍 **Kino nomini kiriting:**",
    not_found: "❌ Kechirasiz, **\"{query}\"** nomli film topilmadi.",
    code_not_found: "🔍 **Kino topilmadi.**\n\nKod: `{code}` ga mos film topilmadi. Nomi bo'yicha qidirib ko'ring.",
    req_prompt: "📝 **Iltimos, buyurtma qilmoqchi bo'lgan kino nomini yozib yuboring:**\n\n(Masalan: `Forsaj 10` yoki `Avatar 2 Uzbek tilida`)",
    req_success: "✅ **Buyurtmangiz muvaffaqiyatli qabul qilindi!**\n\n🎬 Kino nomi: *{title}*\n\nOperatorlarimiz uni tez orada bazaga qo'shishadi.",
    genre_title: "🗂 **\"{genre}\" janridagi kinolar (Sahifa {page}/{totalPages}):**",
    genre_select: "🗂 **Janrlardan birini tanlang:**",
    genre_empty: "🔍 **\"{genre}\"** janrida hozircha kinolar yo'q.",
    search_title: "🔍 **\"{query}\" bo'yicha topilgan kinolar:**",
    prev_btn: "◀️ Oldingi",
    next_btn: "Keyingi ▶️",
    back_genres: "🔙 Janrlar menyusi",
    order_this_movie: "🙋‍♂️ Ushbu kinoni buyurtma qilish",
    views_unit: "marta",
    help_text: "❓ **Yordam bo'limi:**\n\n• Kino kodini (masalan: 1001) yuboring -> Kino yuklab beriladi.\n• Kino nomini yozing -> Kino nomiga qarab qidiriladi.\n• Janrlar bo'yicha qidirish uchun **🗂 Janrlar** tugmasini bosing.\n• Tilni o'zgartirish uchun `/lang` buyrug'ini yuboring.",
    admin_help: "\n\n⚙️ **Admin buyruqlari:**\n• Videoga reply qilib `/add [kod] [nom] | [tavsif] | [janr]` deb yozing."
  },
  ru: {
    welcome: "👋 **Привет, {name}!**\n\nЯ **Xit Film (Kino) Bot**.\n\n🍿 Пришлите код фильма (например: `1001`).\n🔍 Для поиска напишите название фильма или используйте меню ниже.",
    search_btn: "🔍 Поиск фильма",
    genre_btn: "🗂 Жанры",
    req_btn: "🙋‍♂️ Заказать фильм",
    help_btn: "ℹ️ Помощь",
    lang_btn: "🌐 Сменить язык",
    select_lang: "🌐 **Пожалуйста, выберите язык / Iltimos, tilni tanlang:**",
    lang_changed: "✅ Язык успешно изменен на Русский!",
    searching: "🔍 **Введите название фильма:**",
    not_found: "❌ Извините, фильм с названием **\"{query}\"** не найден.",
    code_not_found: "🔍 **Фильм не найден.**\n\nФильм с кодом `{code}` не найден. Попробуйте поиск по названию.",
    req_prompt: "📝 **Пожалуйста, отправьте название фильма, который хотите заказать:**\n\n(Например: `Форсаж 10` или `Аватар 2`)",
    req_success: "✅ **Ваш заказ успешно принят!**\n\n🎬 Название: *{title}*\n\nНаши операторы скоро добавят фильм в базу.",
    genre_title: "🗂 **Фильмы в жанре \"{genre}\" (Страница {page}/{totalPages}):**",
    genre_select: "🗂 **Выберите один из жанров:**",
    genre_empty: "🔍 В жанре **\"{genre}\"** пока нет фильмов.",
    search_title: "🔍 **Найденные фильмы по запросу \"{query}\":**",
    prev_btn: "◀️ Назад",
    next_btn: "Вперед ▶️",
    back_genres: "🔙 Меню жанров",
    order_this_movie: "🙋‍♂️ Заказать этот фильм",
    views_unit: "раз",
    help_text: "❓ **Раздел помощи:**\n\n• Отправьте код фильма (например: 1001) -> Боты отправят видео.\n• Напишите название -> Поиск по названию.\n• Нажмите **🗂 Жанры** для выбора категорий.\n• Для смены языка отправьте `/lang`.",
    admin_help: "\n\n⚙️ **Команды админа:**\n• Ответьте на видео `/add [код] [название] | [описание] | [жанр]`."
  },
  en: {
    welcome: "👋 **Hello, {name}!**\n\nI am the **Xit Film (Movie) Bot**.\n\n🍿 Send a movie code (e.g. `1001`).\n🔍 Type the title or use the menu below to search.",
    search_btn: "🔍 Search Movie",
    genre_btn: "🗂 Genres",
    req_btn: "🙋‍♂️ Request Movie",
    help_btn: "ℹ️ Help",
    lang_btn: "🌐 Change Language",
    select_lang: "🌐 **Please select a language / Iltimos, tilni tanlang:**",
    lang_changed: "✅ Language successfully set to English!",
    searching: "🔍 **Enter movie title:**",
    not_found: "❌ Sorry, movie **\"{query}\"** was not found.",
    code_not_found: "🔍 **Movie not found.**\n\nNo movie matching code `{code}`. Try searching by name.",
    req_prompt: "📝 **Please send the name of the movie you would like to request:**\n\n(e.g., `Fast & Furious 10` or `Avatar 2`)",
    req_success: "✅ **Your request has been accepted!**\n\n🎬 Title: *{title}*\n\nOur operators will add it soon.",
    genre_title: "🗂 **Movies in \"{genre}\" genre (Page {page}/{totalPages}):**",
    genre_select: "🗂 **Select a genre category:**",
    genre_empty: "🔍 No movies available in **\"{genre}\"** genre yet.",
    search_title: "🔍 **Movies found for \"{query}\":**",
    prev_btn: "◀️ Prev",
    next_btn: "Next ▶️",
    back_genres: "🔙 Genres Menu",
    order_this_movie: "🙋‍♂️ Request this movie",
    views_unit: "times",
    help_text: "❓ **Help section:**\n\n• Send a movie code (e.g. 1001) -> Receive video.\n• Type title -> Search by name.\n• Click **🗂 Genres** to browse categories.\n• Type `/lang` to change language.",
    admin_help: "\n\n⚙️ **Admin commands:**\n• Reply to video with `/add [code] [title] | [desc] | [genre]`."
  }
};

function t(lang, key, params = {}) {
  const l = lang && messages[lang] ? lang : 'uz';
  let text = messages[l][key] || messages['uz'][key] || key;
  Object.keys(params).forEach(p => {
    text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
  });
  return text;
}

module.exports = { t };
