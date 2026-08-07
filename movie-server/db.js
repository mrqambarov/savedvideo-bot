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

function addMovie(movie) {
  try {
    const movies = getMovies();
    
    // Check if code already exists
    const index = movies.findIndex(m => String(m.code).trim() === String(movie.code).trim());
    const existing = index !== -1 ? movies[index] : {};
    
    const movieData = {
      code: String(movie.code).trim(),
      title: movie.title || 'Noma\'lum film',
      description: movie.description || '',
      fileId: movie.fileId,
      genre: movie.genre || existing.genre || 'Tarjima kino',
      poster: movie.poster !== undefined ? String(movie.poster || '').trim() : (existing.poster || ''),
      likes: existing.likes || [],
      dislikes: existing.dislikes || [],
      views: existing.views || 0,
      dateAdded: existing.dateAdded || new Date().toISOString()
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
      refQualified: false
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
  for (let i = 13; i >= 0; i--) {
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

  return {
    totalUsers: users.length,
    totalMovies: movies.length,
    growth: { newUsersToday, newUsersWeek, newUsersMonth },
    active: { today: activeToday, week: activeWeek, month: activeMonth },
    usage: { today: usageToday, week: usageWeek, month: usageMonth },
    trend,
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
  saveMovieSettings
};
