const fs = require('fs');
const path = require('path');
function safeReadJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return fallback;
  }
}

function safeSaveJSON(filePath, data) {
  try {
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
    return false;
  }
}

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

const DEFAULT_GENRES = [
  "Triller (18+)",
  "Qo'rqinchli (Horror 18+)",
  "Jangari (18+)",
  "Psixologik (18+)",
  "Dokumental (18+)",
  "Sarguzasht (18+)"
];

// Initialize files safely if they don't exist
if (!fs.existsSync(moviesFile)) safeSaveJSON(moviesFile, []);
if (!fs.existsSync(usersFile)) safeSaveJSON(usersFile, []);
if (!fs.existsSync(statsFile)) {
  safeSaveJSON(statsFile, {
    totalViews: 0,
    totalSearchQueries: 0,
    dailyUsage: {}
  });
}
if (!fs.existsSync(requestsFile)) safeSaveJSON(requestsFile, []);
if (!fs.existsSync(genresFile)) safeSaveJSON(genresFile, DEFAULT_GENRES);
if (!fs.existsSync(searchesFile)) safeSaveJSON(searchesFile, {});
if (!fs.existsSync(tiersFile)) safeSaveJSON(tiersFile, []);

function safeLogActivity(payload) {
  try {
    const serverDb = require(path.resolve(__dirname, '../server/db'));
    if (serverDb && typeof serverDb.logActivity === 'function') {
      serverDb.logActivity(payload);
    }
  } catch (e) {}
}

// Movies CRUD
function getMovies() {
  return safeReadJSON(moviesFile, []);
}

function saveMovies(movies) {
  return safeSaveJSON(moviesFile, movies);
}

function findMovieByCode(code) {
  const movies = getMovies();
  const searchCode = String(code).trim().toLowerCase();
  return movies.find(m => String(m.code).trim().toLowerCase() === searchCode);
}

function searchMoviesByTitle(query) {
  const movies = getMovies();
  const cleanQ = String(query).trim().toLowerCase();
  if (!cleanQ) return [];
  return movies.filter(m => String(m.title).toLowerCase().includes(cleanQ));
}

function addMovie(movieData) {
  const movies = getMovies();
  let code = movieData.code;
  if (!code) {
    let maxCode = 2000;
    movies.forEach(m => {
      const num = parseInt(m.code, 10);
      if (!isNaN(num) && num >= maxCode) {
        maxCode = num;
      }
    });
    code = (maxCode + 1).toString();
  }

  const newMovie = {
    code: String(code),
    title: movieData.title || `18+ Video #${code}`,
    description: movieData.description || '',
    fileId: movieData.fileId || '',
    genre: movieData.genre || 'Triller (18+)',
    poster: movieData.poster || '',
    likes: [],
    dislikes: [],
    views: 0,
    dateAdded: new Date().toISOString()
  };

  movies.push(newMovie);
  saveMovies(movies);

  safeLogActivity({
    bot: '18+ Adult Bot',
    icon: '🔞',
    text: `'${newMovie.title}' 18+ videosi saqlandi (Kod: ${newMovie.code})`,
    color: '#ef4444'
  });

  return newMovie;
}

function addEpisode(serialCode, epNum, fileId, epTitle, seasonNum = 1, serialTitle = '') {
  const movies = getMovies();
  let serial = movies.find(m => String(m.code).trim() === String(serialCode).trim() && m.isSerial);

  if (!serial) {
    serial = {
      code: String(serialCode),
      title: serialTitle || `18+ Serial #${serialCode}`,
      description: 'Ushbu 18+ serial qismlari yuklanmoqda.',
      fileId: '',
      genre: 'Serial (18+)',
      poster: '',
      likes: [],
      dislikes: [],
      views: 0,
      isSerial: true,
      episodes: [],
      dateAdded: new Date().toISOString()
    };
    movies.push(serial);
  }

  if (!serial.episodes) serial.episodes = [];
  const existingEpIdx = serial.episodes.findIndex(e => (e.season || 1) === seasonNum && e.episode === epNum);

  const epObj = {
    season: seasonNum,
    episode: epNum,
    fileId: fileId,
    title: epTitle || `${seasonNum}-mavsum ${epNum}-qism`,
    dateAdded: new Date().toISOString()
  };

  if (existingEpIdx >= 0) {
    serial.episodes[existingEpIdx] = epObj;
  } else {
    serial.episodes.push(epObj);
    serial.episodes.sort((a, b) => {
      if ((a.season || 1) !== (b.season || 1)) return (a.season || 1) - (b.season || 1);
      return a.episode - b.episode;
    });
  }

  saveMovies(movies);

  safeLogActivity({
    bot: '18+ Adult Bot',
    icon: '🔞',
    text: `'${serial.title}' 18+ serialining ${seasonNum}-mavsum, ${epNum}-qismi saqlandi (Kod: ${serialCode})`,
    color: '#ef4444'
  });

  return { movie: serial, episode: epObj };
}

// User CRUD
function getUsers() {
  return safeReadJSON(usersFile, []);
}

function saveUsers(users) {
  return safeSaveJSON(usersFile, users);
}

function addUser(id, username, firstName, referrerId = null) {
  const users = getUsers();
  let user = users.find(u => u.id === id);
  const now = new Date().toISOString();

  if (!user) {
    user = {
      id,
      username: username || '',
      firstName: firstName || '',
      favorites: [],
      searchHistory: [],
      joinedDate: now,
      referredBy: referrerId ? parseInt(referrerId, 10) : null,
      referralCount: 0,
      referralRewardsCount: 0
    };
    users.push(user);
    if (referrerId) {
      const refUser = users.find(u => u.id === parseInt(referrerId, 10));
      if (refUser && refUser.id !== id) {
        refUser.referralCount = (refUser.referralCount || 0) + 1;
      }
    }
    saveUsers(users);
  }
  return user;
}

function getUserLang(userId) {
  const users = getUsers();
  const u = users.find(x => x.id === userId);
  return u ? u.lang || 'uz' : 'uz';
}

function setUserLang(userId, lang) {
  const users = getUsers();
  const u = users.find(x => x.id === userId);
  if (u) {
    u.lang = lang;
    saveUsers(users);
  }
}

function isFavorite(userId, movieCode) {
  const users = getUsers();
  const u = users.find(x => x.id === userId);
  if (!u || !u.favorites) return false;
  return u.favorites.includes(String(movieCode));
}

function toggleFavorite(userId, movieCode) {
  const users = getUsers();
  const u = users.find(x => x.id === userId);
  if (!u) return false;
  if (!u.favorites) u.favorites = [];
  const codeStr = String(movieCode);
  const idx = u.favorites.indexOf(codeStr);
  let isFav = false;
  if (idx >= 0) {
    u.favorites.splice(idx, 1);
  } else {
    u.favorites.push(codeStr);
    isFav = true;
  }
  saveUsers(users);
  return isFav;
}

function deleteMovie(code) {
  const movies = getMovies();
  const searchCode = String(code).trim().toLowerCase();
  const idx = movies.findIndex(m => String(m.code).trim().toLowerCase() === searchCode);
  if (idx !== -1) {
    movies.splice(idx, 1);
    saveMovies(movies);

    safeLogActivity({
      bot: '18+ Adult Bot',
      icon: '🗑️',
      text: `18+ video o'chirildi (Kod: ${code})`,
      color: '#ef4444'
    });

    return true;
  }
  return false;
}

function updateMovie(code, data) {
  const movies = getMovies();
  const searchCode = String(code).trim().toLowerCase();
  const idx = movies.findIndex(m => String(m.code).trim().toLowerCase() === searchCode);
  if (idx !== -1) {
    movies[idx] = {
      ...movies[idx],
      ...data,
      code: String(movies[idx].code)
    };
    saveMovies(movies);

    safeLogActivity({
      bot: '18+ Adult Bot',
      icon: '✏️',
      text: `'${movies[idx].title}' 18+ videosi tahrirlandi (Kod: ${code})`,
      color: '#ef4444'
    });

    return movies[idx];
  } else {
    return addMovie({ ...data, code });
  }
}

function getGenres() {
  try {
    const raw = fs.readFileSync(genresFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_GENRES;
  }
}

function saveGenres(genres) {
  try {
    fs.writeFileSync(genresFile, JSON.stringify(genres, null, 2));
    return genres;
  } catch (e) {
    return null;
  }
}

function getRequests() {
  try {
    const raw = fs.readFileSync(requestsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function addRequest(reqData) {
  const reqs = getRequests();
  const newReq = {
    id: Date.now().toString(),
    userId: reqData.userId,
    username: reqData.username || '',
    query: reqData.query || '',
    status: 'pending',
    date: new Date().toISOString()
  };
  reqs.push(newReq);
  try {
    fs.writeFileSync(requestsFile, JSON.stringify(reqs, null, 2));
    return newReq;
  } catch (e) {
    return null;
  }
}

function completeRequest(id) {
  const reqs = getRequests();
  const req = reqs.find(r => r.id === String(id));
  if (req) {
    req.status = 'completed';
    fs.writeFileSync(requestsFile, JSON.stringify(reqs, null, 2));
    return true;
  }
  return false;
}

function deleteRequest(id) {
  const reqs = getRequests();
  const idx = reqs.findIndex(r => r.id === String(id));
  if (idx !== -1) {
    reqs.splice(idx, 1);
    fs.writeFileSync(requestsFile, JSON.stringify(reqs, null, 2));
    return true;
  }
  return false;
}

const channelsFile = path.join(dataDir, 'channels.json');
function getChannels() {
  try {
    if (fs.existsSync(channelsFile)) {
      const list = JSON.parse(fs.readFileSync(channelsFile, 'utf8'));
      if (Array.isArray(list) && list.length > 0) {
        return list.slice(0, 5);
      }
    }
  } catch (e) {}

  // Fallback to legacy single channel env if channels.json is empty
  const legacyUsername = process.env.ADULT_SPONSOR_CHANNEL_USERNAME;
  const legacyLink = process.env.ADULT_SPONSOR_CHANNEL_LINK;
  if (legacyUsername) {
    return [{
      id: '1',
      title: 'Homiy Kanal',
      username: legacyUsername,
      link: legacyLink || `https://t.me/${legacyUsername.replace('@', '')}`
    }];
  }

  return [];
}

function saveChannels(channels) {
  try {
    const list = Array.isArray(channels) ? channels.slice(0, 5) : [];
    fs.writeFileSync(channelsFile, JSON.stringify(list, null, 2));

    // Also update legacy single channel env for backward compatibility
    if (list.length > 0) {
      process.env.ADULT_SPONSOR_CHANNEL_USERNAME = list[0].username || '';
      process.env.ADULT_SPONSOR_CHANNEL_LINK = list[0].link || '';
    }

    return list;
  } catch (e) {
    return null;
  }
}

function getRewardTiers() {
  try {
    return JSON.parse(fs.readFileSync(tiersFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveRewardTiers(tiers) {
  try {
    fs.writeFileSync(tiersFile, JSON.stringify(tiers, null, 2));
    return tiers;
  } catch (e) {
    return null;
  }
}

function setBanned(userId, banned) {
  const users = getUsers();
  const u = users.find(x => String(x.id) === String(userId));
  if (u) {
    u.banned = !!banned;
    saveUsers(users);
    return true;
  }
  return false;
}

function setVip(userId, isVip) {
  const users = getUsers();
  const u = users.find(x => String(x.id) === String(userId));
  if (u) {
    u.isVip = !!isVip;
    saveUsers(users);
    return true;
  }
  return false;
}

function getAdminIds() {
  const adminIdsStr = process.env.ADULT_ADMIN_IDS || process.env.ADMIN_ID || '6263659922';
  return adminIdsStr.split(',').map(id => id.trim()).filter(Boolean);
}

function addAdminId(newId) {
  const ids = getAdminIds();
  const cleanId = String(newId).trim();
  if (cleanId && !ids.includes(cleanId)) {
    ids.push(cleanId);
    const newStr = ids.join(',');
    process.env.ADULT_ADMIN_IDS = newStr;
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('ADULT_ADMIN_IDS=')) {
        content = content.replace(/ADULT_ADMIN_IDS=.*/, `ADULT_ADMIN_IDS=${newStr}`);
      } else {
        content += `\nADULT_ADMIN_IDS=${newStr}`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
    return true;
  }
  return false;
}

function removeAdminId(delId) {
  let ids = getAdminIds();
  const cleanId = String(delId).trim();
  if (ids.includes(cleanId)) {
    ids = ids.filter(id => id !== cleanId);
    const newStr = ids.join(',');
    process.env.ADULT_ADMIN_IDS = newStr;
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('ADULT_ADMIN_IDS=')) {
        content = content.replace(/ADULT_ADMIN_IDS=.*/, `ADULT_ADMIN_IDS=${newStr}`);
      } else {
        content += `\nADULT_ADMIN_IDS=${newStr}`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
    return true;
  }
  return false;
}

const joinRequestsFile = path.join(dataDir, 'join_requests.json');
function getJoinRequests() {
  try {
    if (fs.existsSync(joinRequestsFile)) {
      return JSON.parse(fs.readFileSync(joinRequestsFile, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function recordJoinRequest(userId, targetStr) {
  try {
    const list = getJoinRequests();
    const cleanTarget = String(targetStr).toLowerCase().replace('@', '').trim();
    const key = `${userId}_${cleanTarget}`;
    if (!list.includes(key)) {
      list.push(key);
      fs.writeFileSync(joinRequestsFile, JSON.stringify(list, null, 2));
    }
    return true;
  } catch (e) {
    return false;
  }
}

function hasJoinedOrRequested(userId, channelObj) {
  const list = getJoinRequests();
  const uId = String(userId);
  const chUsername = (channelObj.username || '').replace('@', '').toLowerCase().trim();
  const chChatId = String(channelObj.chatId || channelObj.id || '').toLowerCase().trim();

  // Extract invite link hash (e.g. "+iMX-1KYUFNAyYTk6" or "fVzdPVH_63Q5OGY6")
  let chLinkHash = '';
  if (channelObj.link) {
    const match = channelObj.link.match(/t\.me\/(?:\+|\+joinchat\/|joinchat\/)?([a-zA-Z0-9_-]+)/);
    if (match && match[1]) chLinkHash = match[1].toLowerCase();
  }

  for (const item of list) {
    if (item.startsWith(uId + '_')) {
      const target = item.replace(uId + '_', '');
      if (!target) continue;
      if (
        (chUsername && (target.includes(chUsername) || chUsername.includes(target))) ||
        (chChatId && (target.includes(chChatId) || chChatId.includes(target))) ||
        (chLinkHash && (target.includes(chLinkHash) || chLinkHash.includes(target)))
      ) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  getMovies,
  saveMovies,
  findMovieByCode,
  searchMoviesByTitle,
  addMovie,
  addEpisode,
  deleteMovie,
  updateMovie,
  getGenres,
  saveGenres,
  getRequests,
  addRequest,
  completeRequest,
  deleteRequest,
  getChannels,
  saveChannels,
  getRewardTiers,
  saveRewardTiers,
  getUsers,
  addUser,
  getUserLang,
  setUserLang,
  isFavorite,
  toggleFavorite,
  setBanned,
  setVip,
  getAdminIds,
  addAdminId,
  removeAdminId,
  recordJoinRequest,
  hasJoinedOrRequested
};

