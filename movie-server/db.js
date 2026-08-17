const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const moviesFile = path.join(dataDir, 'movies.json');
const usersFile = path.join(dataDir, 'users.json');
const statsFile = path.join(dataDir, 'stats.json');
const requestsFile = path.join(dataDir, 'requests.json');
const genresFile = path.join(dataDir, 'genres.json');
const searchesFile = path.join(dataDir, 'searches.json');
const tiersFile = path.join(dataDir, 'reward_tiers.json');

const DEFAULT_GENRES = ['Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Tarjima kino', 'Sarguzasht'];

// Initialize files if they don't exist
if (!fs.existsSync(moviesFile)) {
  fs.writeFileSync(moviesFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(statsFile)) {
  fs.writeFileSync(statsFile, JSON.stringify({
    totalViews: 0,
    totalSearchQueries: 0,
    dailyUsage: {}
  }, null, 2));
}
if (!fs.existsSync(requestsFile)) {
  fs.writeFileSync(requestsFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(genresFile)) {
  fs.writeFileSync(genresFile, JSON.stringify(DEFAULT_GENRES, null, 2));
}
if (!fs.existsSync(searchesFile)) {
  fs.writeFileSync(searchesFile, JSON.stringify({}, null, 2));
}
const settingsFile = path.join(dataDir, 'settings.json');
if (!fs.existsSync(settingsFile)) {
  fs.writeFileSync(settingsFile, JSON.stringify({
    autoPostEnabled: true,
    autoPostChannel: process.env.AUTO_POST_CHANNEL || ''
  }, null, 2));
}

function getMovieSettings() {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { autoPostEnabled: true, autoPostChannel: '' };
  }
}

function saveMovieSettings(settings) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function updateMovieSettings(updates) {
  try {
    const current = getMovieSettings();
    const updated = { ...current, ...updates };
    saveMovieSettings(updated);
    return updated;
  } catch (e) {
    return null;
  }
}

// Movies CRUD
function getMovies() {
  try {
    const raw = fs.readFileSync(moviesFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveMovies(movies) {
  try {
    fs.writeFileSync(moviesFile, JSON.stringify(movies, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving movies:', e.message);
    return false;
  }
}

function safeLogActivity(payload) {
  try {
    const serverDb = require(path.resolve(__dirname, '../server/db'));
    if (serverDb && typeof serverDb.logActivity === 'function') {
      serverDb.logActivity(payload);
    }
  } catch (e) {}
}

function cleanAdText(text) {
  if (!text) return '';
  let str = String(text);
  const lines = str.split('\n');
  const cleanLines = [];

  for (let line of lines) {
    let l = line.trim();
    if (!l) continue;

    if (l.includes('@') || /https?:\/\//i.test(l) || /t\.me\//i.test(l) || /telegram\.me\//i.test(l)) continue;
    if (/orqali/i.test(l) && /kodlarni|olishingiz|ko['`’]?proq/i.test(l)) continue;
    if (/kodlarni/i.test(l)) continue;
    if (/yuklab olingan/i.test(l)) continue;
    if (/obuna bo['`’]?ling/i.test(l)) continue;
    if (/kanali(?:miz)?ga/i.test(l) || /kanalga/i.test(l)) continue;
    if (/reklama|aloqa|admin|boti|botimiz/i.test(l) && /:\s*@/i.test(l)) continue;

    l = l.replace(/^📦?\s*(?:nomi|title|kino nomi|kino)[\s:-]*/gi, '');
    l = l.replace(/^🔑?\s*(?:kodi|kod|code|kino kodi)[\s:-]*/gi, '');
    l = l.replace(/^🗂?\s*(?:janri|janr|genre)[\s:-]*/gi, '');
    l = l.replace(/^📝?\s*(?:tavsifi|tavsif|desc|description)[\s:-]*/gi, '');
    l = l.replace(/^[\s🎬🍿🔥⚡️📌👉📦💬📝-]+/, '').trim();

    l = l.replace(/@[a-zA-Z0-9_]+/g, '').trim();
    l = l.replace(/https?:\/\/\S+/gi, '').trim();
    l = l.replace(/t\.me\/\S+/gi, '').trim();

    if (l.length > 0 && !/^-?\s*orqali/i.test(l)) {
      cleanLines.push(l);
    }
  }

  return cleanLines.join('\n').trim();
}

function addMovie(movie) {
  try {
    const movies = getMovies();
    
    // Check if code already exists
    const index = movies.findIndex(m => String(m.code).trim() === String(movie.code).trim());
    const existing = index !== -1 ? movies[index] : {};

    const cleanedTitle = cleanAdText(movie.title) || existing.title || `Kino #${movie.code}`;
    let cleanedDesc = cleanAdText(movie.description);
    if (!cleanedDesc || cleanedDesc.length < 3) {
      cleanedDesc = `${cleanedTitle} - o'zbek tilida tarjima kino.`;
    }
    
    const movieData = {
      code: String(movie.code).trim(),
      title: cleanedTitle,
      description: cleanedDesc,
      fileId: movie.fileId,
      genre: movie.genre || existing.genre || 'Tarjima kino',
      poster: movie.poster !== undefined ? String(movie.poster || '').trim() : (existing.poster || ''),
      likes: existing.likes || [],
      dislikes: existing.dislikes || [],
      views: existing.views || 0,
      dateAdded: existing.dateAdded || new Date().toISOString(),
      isPremium: movie.isPremium !== undefined ? !!movie.isPremium : (existing.isPremium || false),
      videoUrl: movie.videoUrl !== undefined ? String(movie.videoUrl || '').trim() : (existing.videoUrl || ''),
      type: movie.type || existing.type || 'film',
      seasons: movie.seasons || existing.seasons || [],
      qualities: movie.qualities || existing.qualities || null,
      subtitles: movie.subtitles || existing.subtitles || []
    };

    if (index !== -1) {
      // Overwrite existing code
      movies[index] = movieData;
      safeLogActivity({
        bot: 'Kino Bot',
        type: 'admin',
        actor: '👑 Admin',
        icon: '✏️',
        text: `👑 Admin '${movieData.title}' filmini tahrirladi (Kod: ${movieData.code})`,
        color: '#d946ef'
      });
    } else {
      movies.push(movieData);
      safeLogActivity({
        bot: 'Kino Bot',
        type: 'admin',
        actor: '👑 Admin',
        icon: '🎬',
        text: `👑 Admin '${movieData.title}' filmini saqladi (Kod: ${movieData.code})`,
        color: '#d946ef'
      });
    }
    
    saveMovies(movies);
    return movieData;
  } catch (e) {
    console.error('Error adding movie:', e.message);
    return null;
  }
}

function deleteMovie(code) {
  try {
    let movies = getMovies();
    const initialLength = movies.length;
    movies = movies.filter(m => String(m.code).trim() !== String(code).trim());
    if (movies.length < initialLength) {
      saveMovies(movies);
      safeLogActivity({
        bot: 'Kino Bot',
        type: 'admin',
        actor: '👑 Admin',
        icon: '🗑️',
        text: `👑 Admin kino/serialni o'chirdi (Kod: ${code})`,
        color: '#d946ef'
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error deleting movie:', e.message);
    return false;
  }
}

function getMovieByCode(code) {
  try {
    const movies = getMovies();
    return movies.find(m => String(m.code).trim() === String(code).trim()) || null;
  } catch (e) {
    return null;
  }
}

function searchMovies(query) {
  try {
    const movies = getMovies();
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];
    return movies.filter(m =>
      m.title.toLowerCase().includes(cleanQuery) ||
      m.description.toLowerCase().includes(cleanQuery)
    );
  } catch (e) {
    return [];
  }
}

// Top movies by views or rating (likes - dislikes)
function getTopMovies(by = 'views', limit = 10) {
  try {
    const movies = [...getMovies()];
    if (by === 'rating') {
      movies.sort((a, b) =>
        ((b.likes?.length || 0) - (b.dislikes?.length || 0)) -
        ((a.likes?.length || 0) - (a.dislikes?.length || 0)));
    } else {
      movies.sort((a, b) => (b.views || 0) - (a.views || 0));
    }
    return movies.slice(0, limit);
  } catch (e) {
    return [];
  }
}

function getRandomMovie() {
  try {
    const movies = getMovies();
    if (!movies.length) return null;
    return movies[Math.floor(Math.random() * movies.length)];
  } catch (e) {
    return null;
  }
}

// Favorites (stored as movie codes on the user record)
function toggleFavorite(userId, code) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return { favorited: false };
    if (!Array.isArray(user.favorites)) user.favorites = [];
    const c = String(code).trim();
    const idx = user.favorites.indexOf(c);
    let favorited;
    if (idx === -1) { user.favorites.push(c); favorited = true; }
    else { user.favorites.splice(idx, 1); favorited = false; }
    saveUsers(users);
    return { favorited };
  } catch (e) {
    return { favorited: false };
  }
}

function isFavorite(userId, code) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    return !!(user && Array.isArray(user.favorites) && user.favorites.includes(String(code).trim()));
  } catch (e) {
    return false;
  }
}

function getFavorites(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    const codes = (user && Array.isArray(user.favorites)) ? user.favorites : [];
    const movies = getMovies();
    return codes
      .map(c => movies.find(m => String(m.code).trim() === String(c).trim()))
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function recommendMoviesByMood(moodText) {
  try {
    const movies = getMovies();
    if (!movies || movies.length === 0) return [];

    const query = String(moodText || '').toLowerCase().trim();
    if (!query) return movies.slice(0, 5);

    const keywords = query.split(/\s+/).filter(w => w.length > 2);

    const scored = movies.map(m => {
      let score = 0;
      const title = (m.title || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      const genre = (m.genre || '').toLowerCase();

      keywords.forEach(kw => {
        if (title.includes(kw)) score += 5;
        if (genre.includes(kw)) score += 4;
        if (desc.includes(kw)) score += 2;
      });

      if (query.includes('kulgili') || query.includes('komediya') || query.includes('kulish')) {
        if (genre.includes('komediya')) score += 5;
      }
      if (query.includes('jangari') || query.includes('urush') || query.includes('jang')) {
        if (genre.includes('jangari')) score += 5;
      }
      if (query.includes('qorqincli') || query.includes('daxshat') || query.includes('tasir')) {
        if (genre.includes('daxshat') || desc.includes('daxshat')) score += 5;
      }
      if (query.includes('sevgi') || query.includes('romantika') || query.includes('dram')) {
        if (genre.includes('melodrama') || genre.includes('drama')) score += 5;
      }
      if (query.includes('bolalar') || query.includes('multfilm') || query.includes('multik')) {
        if (genre.includes('multfilm')) score += 5;
      }

      return { movie: m, score };
    });

    const filtered = scored.filter(s => s.score > 0);
    const sorted = (filtered.length > 0 ? filtered : scored).sort((a, b) => b.score - a.score);
    return sorted.map(s => s.movie).slice(0, 10);
  } catch (e) {
    return [];
  }
}

// Users CRUD
function getUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error saving users:', e.message);
  }
}

// Adds a user if new. Optionally attributes them to a referrer (their invite
// is counted as "pending" until the new user performs a real action — see
// qualifyReferral). Returns true if the user was newly created.
function addUser(user, referredBy = null) {
  try {
    const users = getUsers();
    if (users.some(u => Number(u.id) === Number(user.id))) {
      return false;
    }
    const newUser = {
      id: user.id,
      username: user.username || '',
      first_name: user.first_name || '',
      dateJoined: new Date().toISOString(),
      referredBy: null,
      refCount: 0,
      refPending: 0,
      refQualified: false,
      isPremium: false,
      premiumUntil: null
    };
    if (referredBy && Number(referredBy) !== Number(user.id)) {
      const referrer = users.find(u => Number(u.id) === Number(referredBy));
      if (referrer) {
        newUser.referredBy = Number(referredBy);
        referrer.refPending = (referrer.refPending || 0) + 1;
      }
    }
    users.push(newUser);
    saveUsers(users);
    return true;
  } catch (e) {
    console.error('Error adding user:', e.message);
    return false;
  }
}

function isUserPremium(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return false;
    if (user.isPremium === true) {
      if (!user.premiumUntil) return true; // Lifetime
      if (new Date(user.premiumUntil).getTime() > Date.now()) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function upgradeUserToPremium(userId, days = 30) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return false;
    user.isPremium = true;
    const currentExpiry = user.premiumUntil ? new Date(user.premiumUntil).getTime() : Date.now();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    user.premiumUntil = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
    saveUsers(users);
    
    safeLogActivity({
      bot: 'Kino Bot',
      type: 'user',
      actor: user.first_name || String(userId),
      icon: '👑',
      text: `👤 ${user.first_name || userId} VIP obunaga a'zo bo'ldi (${days} kunga)`,
      color: '#fbbf24'
    });
    
    return true;
  } catch (e) {
    console.error('Error upgrading user to premium:', e.message);
    return false;
  }
}

function getUserLang(userId) {
  try {
    const users = getUsers();
    const u = users.find(x => Number(x.id) === Number(userId));
    return u && u.lang ? u.lang : null;
  } catch (e) {
    return null;
  }
}

function setUserLang(userId, lang) {
  try {
    const users = getUsers();
    const u = users.find(x => Number(x.id) === Number(userId));
    if (u) {
      u.lang = lang;
      saveUsers(users);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function setBanned(userId, banned) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return false;
    user.banned = !!banned;
    saveUsers(users);
    return true;
  } catch (e) {
    return false;
  }
}

function isBanned(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    return !!(user && user.banned);
  } catch (e) {
    return false;
  }
}

// Anti-cheat: a referral only counts once the invited user does something real
// (views/searches a movie), not merely opening the bot. Idempotent per user.
function qualifyReferral(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user || !user.referredBy || user.refQualified) return { qualified: false };
    user.refQualified = true;
    const referrer = users.find(u => Number(u.id) === Number(user.referredBy));
    let referrerId = null, refCount = 0;
    if (referrer) {
      referrer.refPending = Math.max(0, (referrer.refPending || 0) - 1);
      referrer.refCount = (referrer.refCount || 0) + 1;
      referrerId = referrer.id;
      refCount = referrer.refCount;
    }
    saveUsers(users);
    return { qualified: true, referrerId, refCount };
  } catch (e) {
    console.error('Error qualifying referral:', e.message);
    return { qualified: false };
  }
}

// Reward tiers: [{ count, reward }] configured by admin.
function getRewardTiers() {
  try {
    const list = JSON.parse(fs.readFileSync(tiersFile, 'utf8'));
    return Array.isArray(list) ? list.sort((a, b) => a.count - b.count) : [];
  } catch (e) {
    return [];
  }
}

function saveRewardTiers(tiers) {
  try {
    const clean = (tiers || [])
      .map(t => ({ count: parseInt(t.count, 10), reward: String(t.reward || '').trim() }))
      .filter(t => t.count > 0 && t.reward)
      .sort((a, b) => a.count - b.count);
    fs.writeFileSync(tiersFile, JSON.stringify(clean, null, 2));
    return clean;
  } catch (e) {
    return null;
  }
}

// After a referrer's count changes, return the highest newly-reached unclaimed
// tier (and mark it claimed), or null.
function claimTierFor(userId, refCount) {
  try {
    const tiers = getRewardTiers();
    if (!tiers.length) return null;
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return null;
    if (!Array.isArray(user.claimedTiers)) user.claimedTiers = [];
    const eligible = tiers.filter(t => t.count <= refCount && !user.claimedTiers.includes(t.count));
    if (!eligible.length) return null;
    const tier = eligible[eligible.length - 1]; // highest reached (tiers sorted asc)
    user.claimedTiers.push(tier.count);
    saveUsers(users);
    return tier;
  } catch (e) {
    return null;
  }
}

// Daily check-in streak.
function checkIn(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return { streak: 0, alreadyToday: false };
    const today = new Date().toISOString().split('T')[0];
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().split('T')[0];
    if (user.lastCheckIn === today) {
      return { streak: user.streak || 0, alreadyToday: true };
    }
    user.streak = user.lastCheckIn === yesterday ? (user.streak || 0) + 1 : 1;
    user.lastCheckIn = today;
    saveUsers(users);
    return { streak: user.streak, alreadyToday: false };
  } catch (e) {
    return { streak: 0, alreadyToday: false };
  }
}

function getReferralInfo(userId) {
  try {
    const users = getUsers();
    const ranked = [...users].sort((a, b) => (b.refCount || 0) - (a.refCount || 0));
    const idx = ranked.findIndex(u => Number(u.id) === Number(userId));
    const user = idx !== -1 ? ranked[idx] : null;
    return {
      refCount: user ? (user.refCount || 0) : 0,
      refPending: user ? (user.refPending || 0) : 0,
      rank: user && (user.refCount || 0) > 0 ? idx + 1 : 0,
      totalUsers: users.length
    };
  } catch (e) {
    return { refCount: 0, refPending: 0, rank: 0, totalUsers: 0 };
  }
}

function getReferralLeaderboard(limit = 200) {
  try {
    const users = getUsers();
    return users
      .filter(u => (u.refCount || 0) > 0 || (u.refPending || 0) > 0)
      .sort((a, b) => (b.refCount || 0) - (a.refCount || 0) || (b.refPending || 0) - (a.refPending || 0))
      .slice(0, limit)
      .map(u => ({
        id: u.id,
        username: u.username || '',
        first_name: u.first_name || '',
        refCount: u.refCount || 0,
        refPending: u.refPending || 0
      }));
  } catch (e) {
    return [];
  }
}

// Stats & Analytics
function getStats() {
  try {
    const raw = fs.readFileSync(statsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { totalViews: 0, totalSearchQueries: 0, dailyUsage: {} };
  }
}

function saveStats(stats) {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Error saving stats:', e.message);
  }
}

function trackMovieView(code) {
  try {
    // Increment views in movies.json
    const movies = getMovies();
    const movieIdx = movies.findIndex(m => String(m.code).trim() === String(code).trim());
    if (movieIdx !== -1) {
      movies[movieIdx].views = (movies[movieIdx].views || 0) + 1;
      saveMovies(movies);
    }

    // Increment overall statistics
    const stats = getStats();
    stats.totalViews = (stats.totalViews || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].movieViews = (stats.dailyUsage[today].movieViews || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking movie view:', e.message);
  }
}

function trackSearch() {
  try {
    const stats = getStats();
    stats.totalSearchQueries = (stats.totalSearchQueries || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].searchQueries = (stats.dailyUsage[today].searchQueries || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking search:', e.message);
  }
}

// Genres (editable list, seeded from DEFAULT_GENRES)
function getGenres() {
  try {
    const raw = fs.readFileSync(genresFile, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : [...DEFAULT_GENRES];
  } catch (e) {
    return [...DEFAULT_GENRES];
  }
}

function saveGenres(list) {
  try {
    const clean = [...new Set((list || []).map(g => String(g).trim()).filter(Boolean))];
    fs.writeFileSync(genresFile, JSON.stringify(clean, null, 2));
    return clean;
  } catch (e) {
    console.error('Error saving genres:', e.message);
    return null;
  }
}

// Search analytics: record each query term with a hit counter and last result count.
function trackSearchQuery(query, resultCount) {
  try {
    const q = String(query || '').toLowerCase().trim();
    if (!q || q.length > 100) return;
    let data = {};
    try { data = JSON.parse(fs.readFileSync(searchesFile, 'utf8')) || {}; } catch (e) { data = {}; }
    const entry = data[q] || { query: q, count: 0, lastResults: 0, lastAt: null };
    entry.count += 1;
    entry.lastResults = Number(resultCount) || 0;
    entry.lastAt = new Date().toISOString();
    data[q] = entry;
    fs.writeFileSync(searchesFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error tracking search query:', e.message);
  }
}

function getSearchAnalytics() {
  try {
    const data = JSON.parse(fs.readFileSync(searchesFile, 'utf8')) || {};
    const all = Object.values(data);
    const byCount = (a, b) => b.count - a.count;
    return {
      totalUnique: all.length,
      top: [...all].sort(byCount).slice(0, 50),
      noResults: all.filter(e => e.lastResults === 0).sort(byCount).slice(0, 50),
    };
  } catch (e) {
    return { totalUnique: 0, top: [], noResults: [] };
  }
}

function trackActiveUser(userId) {
  try {
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    if (!stats.dailyUsage[today].activeUsers) {
      stats.dailyUsage[today].activeUsers = [];
    }
    if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
      stats.dailyUsage[today].activeUsers.push(userId);
      saveStats(stats);
    }
  } catch (e) {
    console.error('Error tracking active user:', e.message);
  }
}

// Requests CRUD
function getRequests() {
  try {
    const raw = fs.readFileSync(requestsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveRequests(requests) {
  try {
    fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving requests:', e.message);
    return false;
  }
}

function addRequest(userId, usernameOrUserObj, titleArg) {
  try {
    let userIdVal = userId;
    let usernameVal = typeof usernameOrUserObj === 'string' ? usernameOrUserObj : null;
    let firstNameVal = null;
    let titleVal = typeof usernameOrUserObj === 'string' ? titleArg : usernameOrUserObj;

    if (typeof userId === 'object' && userId !== null) {
      userIdVal = userId.id;
      usernameVal = userId.username;
      firstNameVal = userId.first_name;
      titleVal = usernameOrUserObj;
    }

    if (!usernameVal || usernameVal === 'Noma\'lum') {
      const users = getUsers();
      const found = users.find(u => Number(u.id) === Number(userIdVal));
      if (found) {
        usernameVal = found.username ? (found.username.startsWith('@') ? found.username : '@' + found.username) : null;
        firstNameVal = firstNameVal || found.first_name;
      }
    }

    const requests = getRequests();
    const newRequest = {
      id: Math.random().toString(36).substring(2, 9),
      userId: userIdVal,
      username: usernameVal || null,
      firstName: firstNameVal || null,
      title: (titleVal || '').trim(),
      status: 'pending',
      dateRequested: new Date().toISOString()
    };
    requests.push(newRequest);
    saveRequests(requests);
    return newRequest;
  } catch (e) {
    console.error('Error adding request:', e.message);
    return null;
  }
}

function completeRequest(id) {
  try {
    const requests = getRequests();
    const idx = requests.findIndex(r => String(r.id) === String(id));
    if (idx !== -1) {
      requests[idx].status = 'completed';
      saveRequests(requests);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error completing request:', e.message);
    return false;
  }
}

function deleteRequest(id) {
  try {
    let requests = getRequests();
    const initialLength = requests.length;
    requests = requests.filter(r => String(r.id) !== String(id));
    if (requests.length < initialLength) {
movies[movieIdx].views = (movies[movieIdx].views || 0) + 1;
      saveMovies(movies);
    }

    // Increment overall statistics
    const stats = getStats();
    stats.totalViews = (stats.totalViews || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].movieViews = (stats.dailyUsage[today].movieViews || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking movie view:', e.message);
  }
}

function trackSearch() {
  try {
    const stats = getStats();
    stats.totalSearchQueries = (stats.totalSearchQueries || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].searchQueries = (stats.dailyUsage[today].searchQueries || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking search:', e.message);
  }
}

// Genres (editable list, seeded from DEFAULT_GENRES)
function getGenres() {
  try {
    const raw = fs.readFileSync(genresFile, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : [...DEFAULT_GENRES];
  } catch (e) {
    return [...DEFAULT_GENRES];
  }
}

function saveGenres(list) {
  try {
    const clean = [...new Set((list || []).map(g => String(g).trim()).filter(Boolean))];
    fs.writeFileSync(genresFile, JSON.stringify(clean, null, 2));
    return clean;
  } catch (e) {
    console.error('Error saving genres:', e.message);
    return null;
  }
}

// Search analytics: record each query term with a hit counter and last result count.
function trackSearchQuery(query, resultCount) {
  try {
    const q = String(query || '').toLowerCase().trim();
    if (!q || q.length > 100) return;
    let data = {};
    try { data = JSON.parse(fs.readFileSync(searchesFile, 'utf8')) || {}; } catch (e) { data = {}; }
    const entry = data[q] || { query: q, count: 0, lastResults: 0, lastAt: null };
    entry.count += 1;
    entry.lastResults = Number(resultCount) || 0;
    entry.lastAt = new Date().toISOString();
    data[q] = entry;
    fs.writeFileSync(searchesFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error tracking search query:', e.message);
  }
}

function getSearchAnalytics() {
  try {
    const data = JSON.parse(fs.readFileSync(searchesFile, 'utf8')) || {};
    const all = Object.values(data);
    const byCount = (a, b) => b.count - a.count;
    return {
      totalUnique: all.length,
      top: [...all].sort(byCount).slice(0, 50),
      noResults: all.filter(e => e.lastResults === 0).sort(byCount).slice(0, 50),
    };
  } catch (e) {
    return { totalUnique: 0, top: [], noResults: [] };
  }
}

function trackActiveUser(userId) {
  try {
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    if (!stats.dailyUsage[today].activeUsers) {
      stats.dailyUsage[today].activeUsers = [];
    }
    if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
      stats.dailyUsage[today].activeUsers.push(userId);
      saveStats(stats);
    }
  } catch (e) {
    console.error('Error tracking active user:', e.message);
  }
}

// Requests CRUD
function getRequests() {
  try {
    const raw = fs.readFileSync(requestsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveRequests(requests) {
  try {
    fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving requests:', e.message);
    return false;
  }
}

function addRequest(userId, usernameOrUserObj, titleArg) {
  try {
    let userIdVal = userId;
    let usernameVal = typeof usernameOrUserObj === 'string' ? usernameOrUserObj : null;
    let firstNameVal = null;
    let titleVal = typeof usernameOrUserObj === 'string' ? titleArg : usernameOrUserObj;

    if (typeof userId === 'object' && userId !== null) {
      userIdVal = userId.id;
      usernameVal = userId.username;
      firstNameVal = userId.first_name;
      titleVal = usernameOrUserObj;
    }

    if (!usernameVal || usernameVal === 'Noma\'lum') {
      const users = getUsers();
      const found = users.find(u => Number(u.id) === Number(userIdVal));
      if (found) {
        usernameVal = found.username ? (found.username.startsWith('@') ? found.username : '@' + found.username) : null;
        firstNameVal = firstNameVal || found.first_name;
      }
    }

    const requests = getRequests();
    const newRequest = {
      id: Math.random().toString(36).substring(2, 9),
      userId: userIdVal,
      username: usernameVal || null,
      firstName: firstNameVal || null,
      title: (titleVal || '').trim(),
      status: 'pending',
      dateRequested: new Date().toISOString()
    };
    requests.push(newRequest);
    saveRequests(requests);
    return newRequest;
  } catch (e) {
    console.error('Error adding request:', e.message);
    return null;
  }
}

function completeRequest(id) {
  try {
    const requests = getRequests();
    const idx = requests.findIndex(r => String(r.id) === String(id));
    if (idx !== -1) {
      requests[idx].status = 'completed';
      saveRequests(requests);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error completing request:', e.message);
    return false;
  }
}

function deleteRequest(id) {
  try {
    let requests = getRequests();
    const initialLength = requests.length;
    requests = requests.filter(r => String(r.id) !== String(id));
    if (requests.length < initialLength) {
      saveRequests(requests);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error deleting request:', e.message);
    return false;
  }
}

// Like/Dislike ratings
function toggleLikeDislike(code, userId, voteType) {
  try {
    const movies = getMovies();
    const index = movies.findIndex(m => String(m.code).trim() === String(code).trim());
    if (index === -1) return null;

    const movie = movies[index];
    if (!movie.likes) movie.likes = [];
    if (!movie.dislikes) movie.dislikes = [];

    const alreadyLiked = movie.likes.includes(userId);
    const alreadyDisliked = movie.dislikes.includes(userId);

    movie.likes = movie.likes.filter(id => id !== userId);
    movie.dislikes = movie.dislikes.filter(id => id !== userId);

    if (voteType === 'like') {
      if (!alreadyLiked) {
        movie.likes.push(userId);
      }
    } else if (voteType === 'dislike') {
      if (!alreadyDisliked) {
        movie.dislikes.push(userId);
      }
    }

    movies[index] = movie;
    saveMovies(movies);
    return {
      likesCount: movie.likes.length,
      dislikesCount: movie.dislikes.length
    };
  } catch (e) {
    console.error('Error toggling rating:', e.message);
    return null;
  }
}

// Sync user activity (Favorites, History) between Web and Bot
function syncUserActivity(userId, data) {
  try {
    const users = getUsers();
    let user = users.find(u => Number(u.id) === Number(userId));
    if (!user) return null;

    if (data.favorite) {
      if (!user.favorites) user.favorites = [];
      const c = String(data.favorite).trim();
      const idx = user.favorites.indexOf(c);
      if (idx === -1) user.favorites.push(c);
      else user.favorites.splice(idx, 1);
    }

    if (data.history) {
      if (!user.watchHistory) user.watchHistory = [];
      const c = String(data.history).trim();
      user.watchHistory = [c, ...user.watchHistory.filter(item => item !== c)].slice(0, 20);
    }

    saveUsers(users);
    return user;
  } catch (e) {
    return null;
  }
}

function addComment(code, userId, username, text) {
  try {
    const movies = getMovies();
    const movie = movies.find(m => String(m.code) === String(code));
    if (!movie) return null;
    if (!movie.comments) movie.comments = [];

    movie.comments.unshift({
      id: Date.now(),
      userId,
      username: username || 'Foydalanuvchi',
      text: String(text).trim(),
      date: new Date().toISOString()
    });

    saveMovies(movies);
    return movie.comments;
  } catch (e) {
    return null;
  }
}

function getAdvancedStats() {
  const users = getUsers();
  const stats = getStats();
  const movies = getMovies();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  function daysAgo(n) {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  const weekAgoStr = daysAgo(7);
  const monthAgoStr = daysAgo(30);

  let newUsersToday = 0, newUsersWeek = 0, newUsersMonth = 0;
  users.forEach(u => {
    if (!u.dateJoined) return;
    const joinDate = u.dateJoined.split('T')[0];
    if (joinDate === todayStr) newUsersToday++;
    if (joinDate >= weekAgoStr) newUsersWeek++;
    if (joinDate >= monthAgoStr) newUsersMonth++;
  });

  const dailyUsage = stats.dailyUsage || {};
  let activeToday = 0, activeWeek = 0, activeMonth = 0;
  let usageToday = { movieViews: 0, searches: 0 };
  let usageWeek = { movieViews: 0, searches: 0 };
  let usageMonth = { movieViews: 0, searches: 0 };

  const activeWeekSet = new Set();
  const activeMonthSet = new Set();

  Object.keys(dailyUsage).forEach(dateStr => {
    const day = dailyUsage[dateStr];
    const activeUsers = day.activeUsers || [];

    if (dateStr === todayStr) {
      activeToday = activeUsers.length;
      usageToday.movieViews = day.movieViews || 0;
      usageToday.searches = day.searchQueries || 0;
    }

    if (dateStr >= weekAgoStr) {
      activeUsers.forEach(id => activeWeekSet.add(id));
      usageWeek.movieViews += day.movieViews || 0;
      usageWeek.searches += day.searchQueries || 0;
    }

    if (dateStr >= monthAgoStr) {
      activeUsers.forEach(id => activeMonthSet.add(id));
      usageMonth.movieViews += day.movieViews || 0;
      usageMonth.searches += day.searchQueries || 0;
    }
  });

  activeWeek = activeWeekSet.size;
  activeMonth = activeMonthSet.size;

  const trend = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = daysAgo(i);
    const day = dailyUsage[dateStr] || {};
    const newUsersOnDay = users.filter(u => u.dateJoined && u.dateJoined.split('T')[0] === dateStr).length;

    trend.push({
      date: dateStr,
      newUsers: newUsersOnDay,
      activeUsers: (day.activeUsers || []).length,
      views: day.movieViews || 0,
      movieViews: day.movieViews || 0,
      searches: day.searchQueries || 0
    });
  }

  return {
    totalUsers: users.length,
    totalMovies: movies.length,
    growth: { newUsersToday, newUsersWeek, newUsersMonth },
    active: { today: activeToday, week: activeWeek, month: activeMonth },
    usage: { today: usageToday, week: usageWeek, month: usageMonth },
    trend,
    usersList: users,
    stats
  };
}

const reviewsFile = path.join(dataDir, 'movie_reviews.json');
if (!fs.existsSync(reviewsFile)) {
  fs.writeFileSync(reviewsFile, JSON.stringify({}, null, 2));
}

function recommendMoviesByMood(moodKey) {
  const movies = getMovies();
  if (!movies || movies.length === 0) return [];
  const map = {
    funny: ['Komediya', 'Multfilm'],
    action: ['Jangari', 'Sarguzasht'],
    romantic: ['Melodrama'],
    family: ['Multfilm', 'Sarguzasht', 'Tarjima kino'],
    historical: ['Tarixiy', 'Triller']
  };
  const targetGenres = map[moodKey] || [];
  if (targetGenres.length === 0) return movies.slice(0, 10);
  const matched = movies.filter(m => targetGenres.some(g => (m.genre || '').toLowerCase().includes(g.toLowerCase())));
  return matched.length > 0 ? matched : movies.slice(0, 10);
}

function getMovieReviews(code) {
  try {
    if (!fs.existsSync(reviewsFile)) return { reviews: [], avgRating: 5.0 };
    const raw = fs.readFileSync(reviewsFile, 'utf8');
    const data = JSON.parse(raw);
    const list = data[String(code)] || [];
    const totalRating = list.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    const avgRating = list.length > 0 ? (totalRating / list.length).toFixed(1) : 5.0;
    return { reviews: list, avgRating: Number(avgRating) };
  } catch (e) {
    return { reviews: [], avgRating: 5.0 };
  }
}

function addMovieReview(code, { name, rating, comment }) {
  try {
    let data = {};
    if (fs.existsSync(reviewsFile)) {
      try { data = JSON.parse(fs.readFileSync(reviewsFile, 'utf8')); } catch (e) {}
    }
    const movieCode = String(code);
    if (!data[movieCode]) data[movieCode] = [];
    const newReview = {
      id: Math.random().toString(36).substring(2, 9),
      name: name || 'Foydalanuvchi',
      rating: Number(rating) || 5,
      comment: String(comment || '').trim(),
      date: new Date().toLocaleDateString()
    };
    data[movieCode].unshift(newReview);
    fs.writeFileSync(reviewsFile, JSON.stringify(data, null, 2));
    return getMovieReviews(movieCode);
  } catch (e) {
    console.error('Error adding movie review:', e.message);
    return null;
  }
}

const instaConfigFile = path.join(dataDir, 'instagram_config.json');

function getInstagramConfig() {
  try {
    if (!fs.existsSync(instaConfigFile)) return { username: '', password: '', autoPost: false };
    return JSON.parse(fs.readFileSync(instaConfigFile, 'utf8'));
  } catch (e) {
    return { username: '', password: '', autoPost: false };
  }
}

function saveInstagramConfig(config) {
  try {
    const existing = getInstagramConfig();
    const merged = {
      ...existing,
      username: (config.username !== undefined ? config.username : existing.username || '').trim(),
      password: (config.password !== undefined ? config.password : existing.password || '').trim(),
      autoPost: config.autoPost !== undefined ? !!config.autoPost : !!existing.autoPost,
      updatedAt: new Date().toISOString(),
      verified: config.verified !== undefined ? config.verified : existing.verified,
      fullName: config.fullName || existing.fullName || '',
      profilePic: config.profilePic || existing.profilePic || '',
      pk: config.pk || existing.pk || null
    };
    fs.writeFileSync(instaConfigFile, JSON.stringify(merged, null, 2));
    return merged;
  } catch (e) {
    console.error('Error saving Instagram config:', e.message);
    return null;
  }
}

function addEpisode(code, episodeNumber, fileId, title, seasonNumber = 1, serialTitle = '', genre = 'Serial') {
  try {
    const movies = getMovies();
    const index = movies.findIndex(m => String(m.code).trim() === String(code).trim());
    
    let movieData;
    if (index !== -1) {
      movieData = movies[index];
      movieData.isSerial = true;
      movieData.genre = 'Serial';
      if (!movieData.episodes) {
        movieData.episodes = [];
      }
    } else {
      movieData = {
        code: String(code).trim(),
        title: serialTitle ? serialTitle : `Serial ${code}`,
        description: `Ushbu serial qismlari yuklanmoqda.`,
        fileId: '',
        genre: genre || 'Serial',
        poster: '',
        likes: [],
        dislikes: [],
        views: 0,
        isSerial: true,
        episodes: [],
        dateAdded: new Date().toISOString()
      };
      movies.push(movieData);
    }

    const epNum = Number(episodeNumber);
    const season = Number(seasonNumber) || 1;
    const epIndex = movieData.episodes.findIndex(e => Number(e.episode) === epNum && (Number(e.season) || 1) === season);
    
    const episodeData = {
      episode: epNum,
      season: season,
      fileId: fileId,
      title: title || `${season > 1 ? season + '-Mavsum ' : ''}${epNum}-qism`,
      dateAdded: new Date().toISOString()
    };

    if (epIndex !== -1) {
      movieData.episodes[epIndex] = episodeData;
    } else {
      movieData.episodes.push(episodeData);
    }

    movieData.episodes.sort((a, b) => {
      if ((a.season || 1) !== (b.season || 1)) return (a.season || 1) - (b.season || 1);
      return a.episode - b.episode;
    });

    saveMovies(movies);

    safeLogActivity({
      bot: 'Kino Bot',
      type: title?.includes('AVTO') ? 'parser' : 'admin',
      actor: title?.includes('AVTO') ? '⚡ Avto-Parser' : '👑 Admin',
      icon: title?.includes('AVTO') ? '⚡' : '🎬',
      text: title?.includes('AVTO')
        ? `⚡ Avto-Parser '${movieData.title}' serialining ${season}-mavsum, ${epNum}-qismini saqladi (Kod: ${movieData.code})`
        : `👑 Admin '${movieData.title}' serialining ${season}-mavsum, ${epNum}-qismini saqladi (Kod: ${movieData.code})`,
      color: '#d946ef'
    });

    return { movie: movieData, episode: episodeData };
  } catch (e) {
    console.error('Error adding episode:', e.message);
    return null;
  }
}

function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase()
    .replace(/[^\w\s\u0400-\u04FF]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingSerialByTitle(title) {
  if (!title) return null;
  const normalized = normalizeTitle(title);
  const movies = getMovies();
  return movies.find(m => m.isSerial && normalizeTitle(m.title) === normalized) || null;
}

function mergeDuplicateSerials() {
  return false;
}

function getStats() {
  try {
    if (!fs.existsSync(statsFile)) {
      return { totalViews: 0, totalSearchQueries: 0, dailyUsage: {} };
    }
    return JSON.parse(fs.readFileSync(statsFile, 'utf8'));
  } catch (e) {
    return { totalViews: 0, totalSearchQueries: 0, dailyUsage: {} };
  }
}

function saveStats(stats) {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function trackMovieView(code, userId = null) {
  try {
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage) stats.dailyUsage = {};
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].movieViews = (stats.dailyUsage[today].movieViews || 0) + 1;
    stats.totalViews = (stats.totalViews || 0) + 1;
    if (userId) {
      if (!Array.isArray(stats.dailyUsage[today].activeUsers)) stats.dailyUsage[today].activeUsers = [];
      if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
        stats.dailyUsage[today].activeUsers.push(userId);
      }
    }
    saveStats(stats);
  } catch (e) {
    console.error('Error tracking movie view:', e.message);
  }
}

function trackSearch(query, userId = null) {
  try {
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage) stats.dailyUsage = {};
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    stats.dailyUsage[today].searchQueries = (stats.dailyUsage[today].searchQueries || 0) + 1;
    stats.totalSearchQueries = (stats.totalSearchQueries || 0) + 1;
    if (userId) {
      if (!Array.isArray(stats.dailyUsage[today].activeUsers)) stats.dailyUsage[today].activeUsers = [];
      if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
        stats.dailyUsage[today].activeUsers.push(userId);
      }
    }
    saveStats(stats);
  } catch (e) {
    console.error('Error tracking search:', e.message);
  }
}

function trackActiveUser(userId) {
  try {
    if (!userId) return;
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage) stats.dailyUsage = {};
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { movieViews: 0, searchQueries: 0, activeUsers: [] };
    }
    if (!Array.isArray(stats.dailyUsage[today].activeUsers)) stats.dailyUsage[today].activeUsers = [];
    if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
      stats.dailyUsage[today].activeUsers.push(userId);
      saveStats(stats);
    }
  } catch (e) {
    console.error('Error tracking active user:', e.message);
  }
}

function getAdvancedStats() {
  try {
    const users = getUsers();
    const movies = getMovies();
    const stats = getStats();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    function daysAgo(n) {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString().split('T')[0];
    }

    const yesterdayStr = daysAgo(1);
    const weekAgoStr = daysAgo(7);
    const monthAgoStr = daysAgo(30);

    let newUsersToday = 0, newUsersYesterday = 0, newUsersWeek = 0, newUsersMonth = 0;
    users.forEach(u => {
      if (!u.dateJoined) return;
      const joinDate = u.dateJoined.split('T')[0];
      if (joinDate === todayStr) newUsersToday++;
      if (joinDate === yesterdayStr) newUsersYesterday++;
      if (joinDate >= weekAgoStr) newUsersWeek++;
      if (joinDate >= monthAgoStr) newUsersMonth++;
    });

    const dailyUsage = stats.dailyUsage || {};
    const activeToday = (dailyUsage[todayStr]?.activeUsers || []).length;
    const activeYesterday = (dailyUsage[yesterdayStr]?.activeUsers || []).length;

    const activeWeekSet = new Set();
    const activeMonthSet = new Set();
    let usageWeek = { movieViews: 0, searches: 0 };
    let usageMonth = { movieViews: 0, searches: 0 };

    Object.keys(dailyUsage).forEach(dateStr => {
      const day = dailyUsage[dateStr] || {};
      const activeUsers = day.activeUsers || [];

      if (dateStr >= weekAgoStr) {
        activeUsers.forEach(id => activeWeekSet.add(id));
        usageWeek.movieViews += day.movieViews || 0;
        usageWeek.searches += day.searchQueries || 0;
      }

      if (dateStr >= monthAgoStr) {
        activeUsers.forEach(id => activeMonthSet.add(id));
        usageMonth.movieViews += day.movieViews || 0;
        usageMonth.searches += day.searchQueries || 0;
      }
    });

    const trend = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = daysAgo(i);
      const day = dailyUsage[dateStr] || {};
      const newUsersOnDay = users.filter(u => u.dateJoined && u.dateJoined.split('T')[0] === dateStr).length;

      trend.push({
        date: dateStr,
        newUsers: newUsersOnDay,
        activeUsers: (day.activeUsers || []).length,
        movieViews: day.movieViews || 0,
        searches: day.searchQueries || 0
      });
    }

    const calculatedViews = movies.reduce((acc, m) => acc + (m.views || 0), 0) || stats.totalViews || 0;

    return {
      totalUsers: users.length,
      totalMovies: movies.length,
      totalViews: calculatedViews,
      totalSearchQueries: stats.totalSearchQueries || 0,
      growth: { newUsersToday, newUsersYesterday, newUsersWeek, newUsersMonth },
      active: { 
        today: activeToday || (users.length > 0 ? 1 : 0), 
        yesterday: activeYesterday, 
        week: Math.max(activeWeekSet.size, users.length), 
        month: users.length 
      },
      usage: {
        today: {
          movieViews: dailyUsage[todayStr]?.movieViews || 0,
          searches: dailyUsage[todayStr]?.searchQueries || 0
        },
        week: usageWeek,
        month: usageMonth
      },
      trend: trend,
      usersList: users
    };
  } catch (e) {
    console.error('Error getting advanced stats:', e.message);
    return {
      totalUsers: 0,
      totalMovies: 0,
      totalViews: 0,
      growth: { newUsersToday: 0, newUsersYesterday: 0, newUsersWeek: 0, newUsersMonth: 0 },
      active: { today: 0, yesterday: 0, week: 0, month: 0 },
      usage: { today: {}, week: {}, month: {} },
      trend: [],
      usersList: []
    };
  }
}

module.exports = {
  getMovies,
  saveMovies,
  addMovie,
  getMovieByCode,
  deleteMovie,
  getTopMovies,
  searchMovies,
  toggleFavorite,
  getFavorites,
  isFavorite,
  getGenres,
  saveGenres,
  trackSearchQuery,
  getSearchAnalytics,
  getUsers,
  addUser,
  getUserLang,
  setUserLang,
  setBanned,
  isBanned,
  qualifyReferral,
  getReferralInfo,
  getReferralLeaderboard,
  getRewardTiers,
  saveRewardTiers,
  claimTierFor,
  checkIn,
  getStats,
  trackMovieView,
  trackSearch,
  trackActiveUser,
  getRequests,
  addRequest,
  completeRequest,
  deleteRequest,
  toggleLikeDislike,
  syncUserActivity,
  addComment,
  getAdvancedStats,
  recommendMoviesByMood,
  getMovieReviews,
  addMovieReview,
  getInstagramConfig,
  saveInstagramConfig,
  addEpisode,
  normalizeTitle,
  findMatchingSerialByTitle,
  mergeDuplicateSerials,
  getMovieSettings,
  saveMovieSettings,
  updateMovieSettings,
  saveAuthCode,
  verifyAuthCode,
  isUserPremium,
  upgradeUserToPremium,
  saveLinkLogin,
  checkLinkLogin,
  saveUsers,
  applyPromoCode,
  savePlaybackProgress,
  getPlaybackProgress,
  getPendingResumeNotifications,
  markResumeNotified,
  subscribeMovieAlert,
  getWaitingUsersForMovie,
  removeMovieAlert,
  addVipStarsPayment,
  getSponsorChannels,
  addSponsorChannel,
  deleteSponsorChannel,
  getShorts,
  saveShorts,
  addShort,
  updateShort,
  deleteShort,
  incrementShortViews,
  toggleShortLike,
  toggleShortBookmark,
  toggleCreatorFollow,
  recordShortInteraction,
  getAlgorithmicShorts,
  getUserBookmarkedShorts,
  addShortComment,
  getShortComments,
  getCreators,
  saveCreators,
  registerCreator,
  addCreatorViews,
  getCreatorStats,
  getCreatorFullProfile
};

function savePlaybackProgress(userId, code, { currentTime, duration, title, poster, genre }) {
  try {
    const cleanCode = String(code || '').trim();
    if (!userId || !cleanCode) return null;
    const users = getUsers();
    let user = users.find(u => Number(u.id) === Number(userId));
    if (!user) {
      user = { id: Number(userId), dateJoined: new Date().toISOString() };
      users.push(user);
    }
    if (!user.playbackProgress) user.playbackProgress = {};
    if (!user.watchHistory) user.watchHistory = [];

    if (!user.watchHistory.includes(cleanCode)) {
      user.watchHistory.unshift(cleanCode);
      if (user.watchHistory.length > 50) user.watchHistory.pop();
    }

    const curTime = Number(currentTime) || 0;
    const dur = Number(duration) || 0;

    user.playbackProgress[cleanCode] = {
      code: cleanCode,
      title: title || user.playbackProgress[cleanCode]?.title || `Kino #${cleanCode}`,
      poster: poster || user.playbackProgress[cleanCode]?.poster || '',
      genre: genre || user.playbackProgress[cleanCode]?.genre || '',
      currentTime: Math.round(curTime),
      duration: Math.round(dur),
      progressPercent: dur > 0 ? Math.min(100, Math.round((curTime / dur) * 100)) : 0,
      lastWatched: Date.now(),
      notified: false
    };

    saveUsers(users);
    return user.playbackProgress[cleanCode];
  } catch (e) {
    console.error('Error saving playback progress:', e.message);
    return null;
  }
}

function getPlaybackProgress(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user || !user.playbackProgress) return [];

    const items = Object.values(user.playbackProgress)
      .filter(item => item.currentTime >= 10 && item.progressPercent < 95)
      .sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));

    return items;
  } catch (e) {
    return [];
  }
}

function getPendingResumeNotifications() {
  try {
    const users = getUsers();
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    const pending = [];

    users.forEach(u => {
      if (!u.playbackProgress || !u.id) return;
      Object.entries(u.playbackProgress).forEach(([code, p]) => {
        // Paused at least 30s in, not finished (< 90%), stopped between 2h and 48h ago, not yet notified
        if (
          !p.notified &&
          p.currentTime >= 30 &&
          p.progressPercent < 90 &&
          p.lastWatched <= twoHoursAgo &&
          p.lastWatched >= fortyEightHoursAgo
        ) {
          pending.push({
            userId: u.id,
            userLang: u.lang || 'uz',
            code: code,
            title: p.title || `Kino #${code}`,
            currentTime: p.currentTime,
            duration: p.duration,
            progressPercent: p.progressPercent,
            lastWatched: p.lastWatched
          });
        }
      });
    });

    return pending;
  } catch (e) {
    console.error('Error getting pending resume notifications:', e.message);
    return [];
  }
}

function markResumeNotified(userId, code) {
  try {
    const cleanCode = String(code || '').trim();
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (user && user.playbackProgress && user.playbackProgress[cleanCode]) {
      user.playbackProgress[cleanCode].notified = true;
      saveUsers(users);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

const authCodes = new Map(); // userId -> { code, expires }
const linkLogins = new Map(); // token -> { user, expires }

function saveAuthCode(userId, code, userObj = null) {
  authCodes.set(String(code).trim(), {
    userId: Number(userId),
    userObj: userObj || null,
    expires: Date.now() + 10 * 60 * 1000 // 10 minutes
  });
}

function verifyAuthCode(code) {
  const cleanCode = String(code || '').trim();
  const entry = authCodes.get(cleanCode);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    authCodes.delete(cleanCode);
    return null;
  }
  authCodes.delete(cleanCode);
  const users = getUsers();
  let user = users.find(u => Number(u.id) === Number(entry.userId));
  if (!user && entry.userObj) {
    addUser(entry.userObj);
    user = entry.userObj;
  }
  return user || { id: entry.userId, first_name: 'Foydalanuvchi' };
}

function saveLinkLogin(token, user) {
  const cleanToken = String(token || '').trim();
  linkLogins.set(cleanToken, {
    user,
    expires: Date.now() + 10 * 60 * 1000 // 10 minutes
  });
}

function checkLinkLogin(token) {
  const cleanToken = String(token || '').trim();
  const entry = linkLogins.get(cleanToken);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    linkLogins.delete(cleanToken);
    return null;
  }
  linkLogins.delete(cleanToken);
  const users = getUsers();
  const fullUser = users.find(u => Number(u.id) === Number(entry.user.id));
  return fullUser || entry.user;
}

function addSerialEpisode(code, seasonNumber, episodeObj) {
  const movies = getMovies();
  const index = movies.findIndex(m => String(m.code).trim() === String(code).trim());
  if (index === -1) return false;
  
  const movie = movies[index];
  movie.type = 'serial';
  if (!movie.seasons) movie.seasons = [];
  
  let season = movie.seasons.find(s => Number(s.seasonNumber) === Number(seasonNumber));
  if (!season) {
    season = { seasonNumber: Number(seasonNumber), episodes: [] };
    movie.seasons.push(season);
  }
  
  const epIndex = season.episodes.findIndex(e => Number(e.episodeNumber) === Number(episodeObj.episodeNumber));
  if (epIndex !== -1) {
    season.episodes[epIndex] = { ...season.episodes[epIndex], ...episodeObj };
  } else {
    season.episodes.push(episodeObj);
  }
  
  saveMovies(movies);
  return true;
}

function applyPromoCode(userId, promoCode) {
  try {
    const cleanCode = String(promoCode || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Promokod kiritilmadi' };

    const users = getUsers();
    const userIndex = users.findIndex(u => Number(u.id) === Number(userId));
    if (userIndex === -1) return { success: false, message: 'Foydalanuvchi topilmadi' };

    const user = users[userIndex];
    if (!user.usedPromos) user.usedPromos = [];

    if (user.usedPromos.includes(cleanCode)) {
      return { success: false, message: 'Ushbu promokoddan avval foydalangansiz' };
    }

    let days = 0;
    if (cleanCode === 'XIT2026' || cleanCode === 'VIP2026' || cleanCode === 'XITFILM') {
      days = 7;
    } else if (cleanCode === 'PREMIUM30') {
      days = 30;
    } else {
      return { success: false, message: 'Yaroqsiz promokod' };
    }

    user.usedPromos.push(cleanCode);
    const now = new Date();
    let currentExp = user.premiumUntil ? new Date(user.premiumUntil) : new Date();
    if (currentExp < now) currentExp = now;
    
    currentExp.setDate(currentExp.getDate() + days);
    user.isPremium = true;
    user.premiumUntil = currentExp.toISOString();

    saveUsers(users);
    return { success: true, message: `Tabriklaymiz! Promokod muvaffaqiyatli faollashtirildi (${days} kunlik VIP berildi)! 🎉`, days, premiumUntil: user.premiumUntil };
  } catch (e) {
    return { success: false, message: 'Server xatosi' };
  }
}

const settingsPath = path.join(dataDir, 'movie_settings.json');

function getMovieSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {}
  return {
    autoPostEnabled: true,
    autoPostChannel: '@XitFilm_uz',
    sponsorUsername: '@XitFilm_uz',
    sponsorLink: 'https://t.me/XitFilm_uz',
    sponsorChannels: [{ username: '@XitFilm_uz', link: 'https://t.me/XitFilm_uz', title: '1-Homiy Kanal' }]
  };
}

function saveMovieSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {}
}

function getAdvancedStats() {
  try {
    const users = getUsers() || [];
    const movies = getMovies() || [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const daysAgo = (n) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString().split('T')[0];
    };

    const weekAgoStr = daysAgo(7);
    const monthAgoStr = daysAgo(30);

    let newUsersToday = 0, newUsersWeek = 0, newUsersMonth = 0;
    users.forEach(u => {
      if (u.dateJoined || u.joinedDate) {
        const joinDate = (u.dateJoined || u.joinedDate).split('T')[0];
        if (joinDate === todayStr) newUsersToday++;
        if (joinDate >= weekAgoStr) newUsersWeek++;
        if (joinDate >= monthAgoStr) newUsersMonth++;
      }
    });

    const totalViews = movies.reduce((sum, m) => sum + (Number(m.views) || 0), 0);

    return {
      totalUsers: users.length,
      totalMovies: movies.length,
      totalViews: totalViews,
      growth: { newUsersToday, newUsersWeek, newUsersMonth },
      active: { today: Math.min(users.length, Math.max(1, newUsersToday || 1)), week: users.length, month: users.length },
      usage: { 
        today: { movieViews: totalViews, searches: 0, downloadsVideo: 0, downloadsAudio: 0 }, 
        week: { movieViews: totalViews }, 
        month: { movieViews: totalViews } 
      },
      trend: []
    };
  } catch (e) {
    return {
      totalUsers: 0,
      totalMovies: 0,
      totalViews: 0,
      growth: { newUsersToday: 0, newUsersWeek: 0, newUsersMonth: 0 },
      active: { today: 0, week: 0, month: 0 },
      usage: { today: { movieViews: 0 } }
    };
  }
}

// ============================================
// PREMYERA QO'NG'IROG'I (MOVIE ALERT SUBSCRIPTIONS)
// ============================================
const alertsFile = path.join(dataDir, 'movie_alerts.json');
if (!fs.existsSync(alertsFile)) {
  fs.writeFileSync(alertsFile, JSON.stringify([], null, 2));
}

function getMovieAlerts() {
  try {
    return JSON.parse(fs.readFileSync(alertsFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveMovieAlerts(alerts) {
  try {
    fs.writeFileSync(alertsFile, JSON.stringify(alerts, null, 2));
  } catch (e) {}
}

function subscribeMovieAlert(userId, query) {
  try {
    if (!userId || !query) return false;
    const cleanQuery = String(query).toLowerCase().trim();
    if (cleanQuery.length < 2) return false;

    const alerts = getMovieAlerts();
    const existing = alerts.find(a => Number(a.userId) === Number(userId) && a.query === cleanQuery);
    if (existing) return true;

    alerts.push({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      userId: Number(userId),
      query: cleanQuery,
      createdAt: Date.now()
    });

    saveMovieAlerts(alerts);
    return true;
  } catch (e) {
    console.error('Error subscribing movie alert:', e.message);
    return false;
  }
}

function getWaitingUsersForMovie(movieTitle) {
  try {
    if (!movieTitle) return [];
    const normalizedMovie = normalizeTitle(movieTitle);
    const alerts = getMovieAlerts();
    const matchedUserIds = new Set();
    const matchedAlertIds = [];

    alerts.forEach(a => {
      const alertQuery = normalizeTitle(a.query);
      if (alertQuery && (normalizedMovie.includes(alertQuery) || alertQuery.includes(normalizedMovie))) {
        matchedUserIds.add(a.userId);
        matchedAlertIds.push(a.id);
      }
    });

    return {
      userIds: Array.from(matchedUserIds),
      alertIds: matchedAlertIds
    };
  } catch (e) {
    return { userIds: [], alertIds: [] };
  }
}

function removeMovieAlert(userId, query) {
  try {
    let alerts = getMovieAlerts();
    if (query) {
      const clean = String(query).toLowerCase().trim();
      alerts = alerts.filter(a => !(Number(a.userId) === Number(userId) && a.query === clean));
    } else {
      alerts = alerts.filter(a => Number(a.userId) !== Number(userId));
    }
    saveMovieAlerts(alerts);
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================
// TELEGRAM STARS VIP PAYMENT TRACKING
// ============================================
const starsPaymentsFile = path.join(dataDir, 'stars_payments.json');
if (!fs.existsSync(starsPaymentsFile)) {
  fs.writeFileSync(starsPaymentsFile, JSON.stringify([], null, 2));
}

function addVipStarsPayment(userId, days, starsAmount, paymentDetails = {}) {
  try {
    const upgradeRes = upgradeUserToPremium(userId, days);
    
    let payments = [];
    try {
      payments = JSON.parse(fs.readFileSync(starsPaymentsFile, 'utf8'));
    } catch (e) {}

    payments.push({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      userId: Number(userId),
      days,
      starsAmount: Number(starsAmount) || 0,
      currency: 'XTR',
      paymentDetails,
      date: new Date().toISOString()
    });

    fs.writeFileSync(starsPaymentsFile, JSON.stringify(payments, null, 2));
    return upgradeRes;
  } catch (e) {
    console.error('Error recording Stars payment:', e.message);
    return { success: false };
  }
}

// ============================================
// SPONSOR CHANNELS MANAGEMENT
// ============================================
function getSponsorChannels() {
  const settings = getMovieSettings() || {};
  return settings.sponsorChannels || [];
}

function addSponsorChannel(channel) {
  try {
    const settings = getMovieSettings() || {};
    if (!settings.sponsorChannels) settings.sponsorChannels = [];
    
    const cleanUsername = String(channel.username || '').replace('@', '').trim();
    if (!cleanUsername) return false;

    // Check if exists
    settings.sponsorChannels = settings.sponsorChannels.filter(c => c.username.replace('@', '') !== cleanUsername);
    settings.sponsorChannels.push({
      username: `@${cleanUsername}`,
      link: channel.link || `https://t.me/${cleanUsername}`,
      title: channel.title || `@${cleanUsername}`
    });

    saveMovieSettings(settings);
    return true;
  } catch (e) {
    return false;
  }
}

function deleteSponsorChannel(username) {
  try {
    const settings = getMovieSettings() || {};
    if (!settings.sponsorChannels) return true;
    
    const clean = String(username || '').replace('@', '').trim();
    settings.sponsorChannels = settings.sponsorChannels.filter(c => c.username.replace('@', '') !== clean);
    saveMovieSettings(settings);
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================
// SHORTS & CREATORS (HAMKORLIK / PARTNERS)
// ============================================
const shortsFile = path.join(dataDir, 'shorts.json');
const creatorsFile = path.join(dataDir, 'creators.json');

function getShorts() {
  try {
    if (!fs.existsSync(shortsFile)) return [];
    return JSON.parse(fs.readFileSync(shortsFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveShorts(shorts) {
  try {
    fs.writeFileSync(shortsFile, JSON.stringify(shorts, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function addShort(data) {
  try {
    const shorts = getShorts();
    const newShort = {
      id: 'sh_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: data.title || 'Qiziqarli Kino Lavha',
      description: data.description || '',
      videoUrl: data.videoUrl || '',
      poster: data.poster || '',
      duration: data.duration || '1:00',
      movieCode: String(data.movieCode || '').trim(),
      movieTitle: data.movieTitle || '',
      creatorId: data.creatorId || 'cre_official',
      creatorName: data.creatorName || 'XIT FILM Official',
      creatorTag: data.creatorTag || '@xitfilm_uz',
      views: 0,
      likes: [],
      shares: 0,
      status: data.status || 'active',
      dateAdded: new Date().toISOString()
    };
    shorts.unshift(newShort);
    saveShorts(shorts);
    return newShort;
  } catch (e) {
    return null;
  }
}

function deleteShort(id) {
  try {
    let shorts = getShorts();
    const initial = shorts.length;
    shorts = shorts.filter(s => String(s.id) !== String(id));
    if (shorts.length < initial) {
      saveShorts(shorts);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function incrementShortViews(id, refCode = null) {
  try {
    const shorts = getShorts();
    const short = shorts.find(s => String(s.id) === String(id));
    if (short) {
      short.views = (short.views || 0) + 1;
      saveShorts(shorts);

      // Track creator stats and reward
      const creatorId = short.creatorId;
      if (creatorId) {
        addCreatorViews(creatorId, 1);
      }
      return short.views;
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

function toggleShortLike(id, userId) {
  try {
    const shorts = getShorts();
    const short = shorts.find(s => String(s.id) === String(id));
    if (!short) return { liked: false, totalLikes: 0 };
    if (!Array.isArray(short.likes)) short.likes = [];
    
    const uidStr = String(userId);
    const idx = short.likes.indexOf(uidStr);
    let liked = false;
    if (idx !== -1) {
      short.likes.splice(idx, 1);
      liked = false;
    } else {
      short.likes.push(uidStr);
      liked = true;
    }
    saveShorts(shorts);
    return { liked, totalLikes: short.likes.length };
  } catch (e) {
    return { liked: false, totalLikes: 0 };
  }
}

function updateShort(id, data) {
  try {
    const shorts = getShorts();
    const idx = shorts.findIndex(s => String(s.id) === String(id));
    if (idx === -1) return null;
    shorts[idx] = {
      ...shorts[idx],
      ...data,
      id: shorts[idx].id // protect id
    };
    saveShorts(shorts);
    return shorts[idx];
  } catch (e) {
    return null;
  }
}

function addShortComment(id, comment) {
  try {
    const shorts = getShorts();
    const short = shorts.find(s => String(s.id) === String(id));
    if (!short) return null;
    if (!Array.isArray(short.comments)) short.comments = [];
    const newComment = {
      id: 'c_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      userId: comment.userId || 'guest',
      userName: comment.userName || 'Kino Muxlisi',
      userTag: comment.userTag || '',
      text: String(comment.text || '').trim().substring(0, 300),
      createdAt: new Date().toISOString()
    };
    short.comments.unshift(newComment);
    if (short.comments.length > 100) short.comments.pop();
    saveShorts(shorts);
    return newComment;
  } catch (e) {
    return null;
  }
}

function getShortComments(id) {
  try {
    const shorts = getShorts();
    const short = shorts.find(s => String(s.id) === String(id));
    return short && Array.isArray(short.comments) ? short.comments : [];
  } catch (e) {
    return [];
  }
}

function toggleShortBookmark(id, userId) {
  try {
    const shorts = getShorts();
    const short = shorts.find(s => String(s.id) === String(id));
    if (!short) return { bookmarked: false, totalBookmarks: 0 };
    if (!Array.isArray(short.bookmarks)) short.bookmarks = [];

    const uidStr = String(userId);
    const idx = short.bookmarks.indexOf(uidStr);
    let bookmarked = false;
    if (idx !== -1) {
      short.bookmarks.splice(idx, 1);
      bookmarked = false;
    } else {
      short.bookmarks.push(uidStr);
      bookmarked = true;
    }
    saveShorts(shorts);
    return { bookmarked, totalBookmarks: short.bookmarks.length };
  } catch (e) {
    return { bookmarked: false, totalBookmarks: 0 };
  }
}

function toggleCreatorFollow(creatorIdOrTag, userId) {
  try {
    const creators = getCreators();
    const clean = String(creatorIdOrTag).replace('@', '').toLowerCase();
    const creator = creators.find(c => 
      String(c.id) === clean || 
      (c.username && c.username.replace('@', '').toLowerCase() === clean) ||
      (c.tag && c.tag.replace('@', '').toLowerCase() === clean)
    );

    if (!creator) return { following: true, followers: 1 };
    if (!Array.isArray(creator.followersList)) creator.followersList = [];

    const uidStr = String(userId);
    const idx = creator.followersList.indexOf(uidStr);
    let following = false;
    if (idx !== -1) {
      creator.followersList.splice(idx, 1);
      following = false;
    } else {
      creator.followersList.push(uidStr);
      following = true;
    }
    creator.followers = creator.followersList.length;
    saveCreators(creators);
    return { following, followers: creator.followers };
  } catch (e) {
    return { following: false, followers: 0 };
  }
}

function recordShortInteraction(id, data = {}) {
  try {
    const shorts = getShorts();
    const short = shorts.find(s => String(s.id) === String(id));
    if (!short) return null;

    const watchTime = Number(data.watchTime) || 0;
    const duration = Number(data.duration) || 30;
    const completed = !!data.completed;

    if (!short.metrics) {
      short.metrics = { totalWatchTime: 0, completions: 0, plays: 0, skips: 0 };
    }

    short.metrics.plays = (short.metrics.plays || 0) + 1;
    short.metrics.totalWatchTime = (short.metrics.totalWatchTime || 0) + watchTime;
    if (completed) short.metrics.completions = (short.metrics.completions || 0) + 1;
    if (watchTime < 2.5 && !completed) short.metrics.skips = (short.metrics.skips || 0) + 1;

    // Calculate retention score (0.0 to 1.0)
    const totalSessions = Math.max(1, (short.metrics.plays || 1));
    short.retentionRate = Math.min(1.0, Math.max(0.1, (short.metrics.completions || 0) / totalSessions));

    saveShorts(shorts);
    return { success: true, retentionRate: short.retentionRate };
  } catch (e) {
    return null;
  }
}

function calculateViralScore(short) {
  const views = Number(short.views) || 0;
  const likesCount = Array.isArray(short.likes) ? short.likes.length : (short.likes || 0);
  const shares = Number(short.shares) || 0;
  const commentsCount = Array.isArray(short.comments) ? short.comments.length : 0;
  const bookmarksCount = Array.isArray(short.bookmarks) ? short.bookmarks.length : 0;
  const retention = Number(short.retentionRate) || 0.6;

  // Instagram Reels engagement formula
  const rawScore = (views * 1) + (likesCount * 14) + (shares * 28) + (commentsCount * 18) + (bookmarksCount * 22) + (retention * 60);

  // Time decay gravity: recent videos get boosted
  const postDate = short.dateAdded ? new Date(short.dateAdded).getTime() : Date.now();
  const hoursSince = Math.max(0.5, (Date.now() - postDate) / (1000 * 60 * 60));
  const timeDecay = 1 / Math.pow(hoursSince + 2, 1.25);

  return rawScore * timeDecay;
}

function getAlgorithmicShorts({ feedType = 'foryou', genre, userId }) {
  try {
    let allShorts = getShorts().filter(s => s.status === 'active');
    if (allShorts.length === 0) return [];

    const movies = getMovies();
    const moviesMap = new Map();
    movies.forEach(m => moviesMap.set(String(m.code), m));

    // Attach movie details if missing
    allShorts = allShorts.map(s => {
      const m = moviesMap.get(String(s.movieCode));
      return {
        ...s,
        genre: s.genre || (m ? m.genre : 'Tarjima kino'),
        movieRating: m ? m.rating : '8.6',
        likesCount: Array.isArray(s.likes) ? s.likes.length : (s.likes || 0),
        commentsCount: Array.isArray(s.comments) ? s.comments.length : 0,
        bookmarksCount: Array.isArray(s.bookmarks) ? s.bookmarks.length : 0,
        viralScore: calculateViralScore(s)
      };
    });

    if (genre && genre !== 'all') {
      const cleanGenre = genre.toLowerCase();
      return allShorts.filter(s => (s.genre && s.genre.toLowerCase().includes(cleanGenre)) || (s.title && s.title.toLowerCase().includes(cleanGenre)));
    }

    if (feedType === 'trending') {
      // Sort strictly by Viral Engagement Score
      return allShorts.sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));
    }

    if (feedType === 'new') {
      // Sort by newest upload first
      return allShorts.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
    }

    // Default: 'foryou' (AI Personalized & Engagement Blended Feed)
    const uidStr = String(userId || '');
    const userLikedCodes = new Set();
    const userLikedGenres = new Set();

    if (uidStr) {
      allShorts.forEach(s => {
        if (Array.isArray(s.likes) && s.likes.includes(uidStr)) {
          if (s.movieCode) userLikedCodes.add(String(s.movieCode));
          if (s.genre) userLikedGenres.add(s.genre.toLowerCase());
        }
      });
    }

    // Rank each short with Personalization Affinity Multiplier
    const scored = allShorts.map(s => {
      let affinity = 1.0;
      if (userLikedCodes.has(String(s.movieCode))) affinity += 1.5;
      if (s.genre && userLikedGenres.has(s.genre.toLowerCase())) affinity += 1.2;

      // Completion bonus
      if ((s.retentionRate || 0) > 0.75) affinity += 0.8;

      return {
        item: s,
        rank: (s.viralScore || 1) * affinity + Math.random() * 1.5 // subtle exploration jitter
      };
    });

    scored.sort((a, b) => b.rank - a.rank);
    return scored.map(s => s.item);
  } catch (e) {
    console.error('Error getting algorithmic shorts:', e.message);
    return getShorts().filter(s => s.status === 'active');
  }
}

function getUserBookmarkedShorts(userId) {
  try {
    const uidStr = String(userId);
    return getShorts().filter(s => Array.isArray(s.bookmarks) && s.bookmarks.includes(uidStr));
  } catch (e) {
    return [];
  }
}

function getCreators() {
  try {
    if (!fs.existsSync(creatorsFile)) return [];
    return JSON.parse(fs.readFileSync(creatorsFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveCreators(creators) {
  try {
    fs.writeFileSync(creatorsFile, JSON.stringify(creators, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function registerCreator({ name, username, telegramId, phone }) {
  try {
    const creators = getCreators();
    const cleanUsername = String(username || '').replace('@', '').trim();
    const refCode = cleanUsername || ('ref_' + Math.random().toString(36).substring(2, 7));

    // Check if already registered
    let creator = creators.find(c => (telegramId && Number(c.telegramId) === Number(telegramId)) || (cleanUsername && c.username.replace('@', '') === cleanUsername));
    if (creator) return { isNew: false, creator };

    creator = {
      id: 'cre_' + Date.now().toString(36),
      name: name || `@${cleanUsername}`,
      username: `@${cleanUsername}`,
      telegramId: telegramId ? Number(telegramId) : null,
      phone: phone || '',
      refCode: refCode.toLowerCase(),
      balance: 10000, // 10,000 UZS welcome bonus
      totalViews: 0,
      totalEarned: 10000,
      status: 'active',
      ratePer1kViews: 5000,
      dateJoined: new Date().toISOString()
    };

    creators.push(creator);
    saveCreators(creators);
    return { isNew: true, creator };
  } catch (e) {
    return null;
  }
}

function addCreatorViews(creatorId, viewsCount = 1) {
  try {
    const creators = getCreators();
    const creator = creators.find(c => c.id === creatorId || c.refCode === creatorId);
    if (creator) {
      creator.totalViews = (creator.totalViews || 0) + viewsCount;
      // Rate: 5,000 UZS per 1,000 views = 5 UZS per view
      const earn = viewsCount * ((creator.ratePer1kViews || 5000) / 1000);
      creator.balance = (creator.balance || 0) + earn;
      creator.totalEarned = (creator.totalEarned || 0) + earn;
      saveCreators(creators);
    }
  } catch (e) {}
}

function getCreatorStats(creatorIdOrRef) {
  try {
    const creators = getCreators();
    const creator = creators.find(c => c.id === creatorIdOrRef || c.refCode === creatorIdOrRef || (c.username && c.username.replace('@', '') === String(creatorIdOrRef).replace('@', '')));
    if (!creator) return null;

    const allShorts = getShorts().filter(s => s.creatorId === creator.id);
    return {
      creator,
      shortsCount: allShorts.length,
      shorts: allShorts
    };
  } catch (e) {
    return null;
  }
}

function getCreatorFullProfile(creatorTagOrId, currentUserId = null) {
  try {
    const cleanTag = String(creatorTagOrId || '').trim().replace('@', '').toLowerCase();
    const creators = getCreators();
    
    // Find creator or build dynamic profile for standard channels
    let creator = creators.find(c => 
      String(c.id).toLowerCase() === cleanTag || 
      (c.username && c.username.replace('@', '').toLowerCase() === cleanTag) ||
      (c.refCode && c.refCode.toLowerCase() === cleanTag) ||
      (c.tag && c.tag.replace('@', '').toLowerCase() === cleanTag)
    );

    const isXitFilm = cleanTag === 'xitfilm_uz' || cleanTag === 'xitfilm' || cleanTag === 'cre_official' || !creator;

    if (!creator) {
      creator = {
        id: isXitFilm ? 'cre_official' : `cre_${cleanTag}`,
        name: isXitFilm ? 'XIT FILM Official' : `@${cleanTag}`,
        username: `@${cleanTag || 'xitfilm_uz'}`,
        avatar: isXitFilm ? '/icon-512.png' : '',
        bio: isXitFilm ? '🎬 XIT FILM — O\'zbekistondagi 1-raqamli onlayn kinoteatr va Telegram kinobot tarmog\'i. Eng sara filmlar va premyeralar.' : 'XIT FILM hamkori va kino ijodkori.',
        telegramChannel: `https://t.me/${cleanTag || 'xitfilm_uz'}`,
        isVerified: true,
        followers: isXitFilm ? 24500 : 120,
        followersList: []
      };
    }

    const allShorts = getShorts().filter(s => {
      const sTag = String(s.creatorTag || s.creatorId || '').replace('@', '').toLowerCase();
      return sTag === cleanTag || (isXitFilm && (sTag === 'xitfilm_uz' || sTag === 'xitfilm' || s.creatorId === 'cre_official'));
    });

    const totalViews = allShorts.reduce((acc, s) => acc + (s.views || 0), 0);
    const totalLikes = allShorts.reduce((acc, s) => acc + (Array.isArray(s.likes) ? s.likes.length : (s.likes || 0)), 0);

    const uidStr = String(currentUserId || '');
    const isFollowing = Array.isArray(creator.followersList) && creator.followersList.includes(uidStr);

    return {
      id: creator.id,
      name: creator.name || 'XIT FILM Official',
      username: creator.username || '@xitfilm_uz',
      avatar: creator.avatar || '',
      bio: creator.bio || 'Eng sara kinolar va qiziqarli epizodlar.',
      telegramChannel: creator.telegramChannel || `https://t.me/${cleanTag}`,
      isVerified: creator.isVerified !== false,
      followers: creator.followers || (isXitFilm ? 24500 : 120),
      isFollowing: !!isFollowing,
      totalViews,
      totalLikes,
      shortsCount: allShorts.length,
      shorts: allShorts.map(s => ({
        id: s.id,
        title: s.title,
        poster: s.poster,
        videoUrl: s.videoUrl,
        views: s.views || 0,
        likesCount: Array.isArray(s.likes) ? s.likes.length : (s.likes || 0),
        movieCode: s.movieCode,
        movieTitle: s.movieTitle
      }))
    };
  } catch (e) {
    console.error('Error getting creator full profile:', e.message);
    return null;
  }
}



