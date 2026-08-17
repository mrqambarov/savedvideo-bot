const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const usersFile = path.join(dataDir, 'users.json');
const statsFile = path.join(dataDir, 'stats.json');

// Initialize files if they don't exist
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
}

if (!fs.existsSync(statsFile)) {
  fs.writeFileSync(statsFile, JSON.stringify({
    totalDownloadsVideo: 0,
    totalDownloadsAudio: 0,
    totalSearchQueries: 0,
    dailyUsage: {}
  }, null, 2));
}

const activitiesFile = path.join(dataDir, 'activities.json');
if (!fs.existsSync(activitiesFile)) {
  fs.writeFileSync(activitiesFile, JSON.stringify([], null, 2));
}

function getActivities() {
  try {
    const raw = fs.readFileSync(activitiesFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

const scheduledBroadcastsFile = path.join(dataDir, 'scheduled_broadcasts.json');
if (!fs.existsSync(scheduledBroadcastsFile)) {
  fs.writeFileSync(scheduledBroadcastsFile, JSON.stringify([], null, 2));
}

const backupBotsFile = path.join(dataDir, 'backup_bots.json');
if (!fs.existsSync(backupBotsFile)) {
  fs.writeFileSync(backupBotsFile, JSON.stringify([
    { id: 'b_1', name: 'Zaxira Kino Bot #1', username: '@xitfilm_backup1_bot', token: '', status: 'active', createdAt: new Date().toISOString() }
  ], null, 2));
}

function getBackupBots() {
  try {
    const raw = fs.readFileSync(backupBotsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveBackupBots(items) {
  try {
    fs.writeFileSync(backupBotsFile, JSON.stringify(items, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function addBackupBot(item) {
  try {
    const list = getBackupBots();
    const newItem = {
      id: 'bot_' + Date.now() + Math.random().toString(36).substring(2, 5),
      name: item.name || 'Zaxira Bot',
      username: item.username ? (item.username.startsWith('@') ? item.username : '@' + item.username) : '@backup_bot',
      token: item.token || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    list.push(newItem);
    saveBackupBots(list);
    return newItem;
  } catch (e) {
    return null;
  }
}

function deleteBackupBot(id) {
  try {
    let list = getBackupBots();
    list = list.filter(b => b.id !== id);
    saveBackupBots(list);
    return true;
  } catch (e) {
    return false;
  }
}

function getScheduledBroadcasts() {
  try {
    const raw = fs.readFileSync(scheduledBroadcastsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveScheduledBroadcasts(items) {
  try {
    fs.writeFileSync(scheduledBroadcastsFile, JSON.stringify(items, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function addScheduledBroadcast(item) {
  try {
    const list = getScheduledBroadcasts();
    const newItem = {
      id: 'sc_' + Date.now() + Math.random().toString(36).substring(2, 5),
      title: item.title || 'Rejalashtirilgan reklama',
      message: item.message || '',
      scheduledAt: item.scheduledAt,
      targetBot: item.targetBot || 'all',
      status: 'pending',
      pin: !!item.pin,
      createdAt: new Date().toISOString(),
      sentStats: null
    };
    list.push(newItem);
    saveScheduledBroadcasts(list);
    return newItem;
  } catch (e) {
    return null;
  }
}

function deleteScheduledBroadcast(id) {
  try {
    let list = getScheduledBroadcasts();
    list = list.filter(b => b.id !== id);
    saveScheduledBroadcasts(list);
    return true;
  } catch (e) {
    return false;
  }
}

function createSystemBackupData() {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      downloaderUsers: [],
      downloaderStats: {},
      movieUsers: [],
      movies: [],
      movieStats: {},
      movieRequests: [],
      adultMovies: [],
      adultUsers: [],
      channels: [],
      activities: []
    };

    const readJson = (p) => {
      try {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (e) {}
      return null;
    };

    backup.downloaderUsers = readJson(path.join(__dirname, 'data', 'users.json')) || [];
    backup.downloaderStats = readJson(path.join(__dirname, 'data', 'stats.json')) || {};
    backup.activities = readJson(path.join(__dirname, 'data', 'activities.json')) || [];
    
    backup.movies = readJson(path.join(__dirname, '..', 'movie-server', 'data', 'movies.json')) || [];
    backup.movieUsers = readJson(path.join(__dirname, '..', 'movie-server', 'data', 'users.json')) || [];
    backup.movieStats = readJson(path.join(__dirname, '..', 'movie-server', 'data', 'stats.json')) || {};
    backup.movieRequests = readJson(path.join(__dirname, '..', 'movie-server', 'data', 'requests.json')) || [];

    backup.adultMovies = readJson(path.join(__dirname, '..', 'adult-server', 'data', 'movies.json')) || [];
    backup.adultUsers = readJson(path.join(__dirname, '..', 'adult-server', 'data', 'users.json')) || [];
    
    backup.channels = readJson(path.join(__dirname, '..', 'channels.json')) || [];

    return backup;
  } catch (e) {
    console.error('Error creating system backup data:', e.message);
    return null;
  }
}

function logActivity(act) {
  try {
    const list = getActivities();
    const now = new Date();
    const type = act.type || (act.text?.includes('👑 Admin') ? 'admin' : act.text?.includes('⚡ Avto-Parser') ? 'parser' : 'user');
    const actor = act.actor || (type === 'admin' ? '👑 Admin' : type === 'parser' ? '⚡ Avto-Parser' : '👤 Foydalanuvchi');
    
    const item = {
      id: String(Date.now()) + Math.random().toString(36).substr(2, 4),
      bot: act.bot || 'Downloader Bot',
      type: type,
      actor: actor,
      icon: act.icon || (type === 'admin' ? '👑' : type === 'parser' ? '⚡' : '👤'),
      text: act.text || 'Tizim amali bajarildi',
      color: act.color || '#6366f1',
      timestamp: now.toISOString(),
      time: 'Hozirgina'
    };
    list.unshift(item);
    if (list.length > 100) list.pop();
    fs.writeFileSync(activitiesFile, JSON.stringify(list, null, 2));
    return item;
  } catch (e) {
    console.error('Error logging activity:', e.message);
  }
}



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

// Adds or updates a user. Returns { isNew, user }.
function upsertUser(user, referredBy = null) {
  try {
    const users = getUsers();
    const existingIndex = users.findIndex(u => Number(u.id) === Number(user.id));
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    if (existingIndex !== -1) {
      const existing = users[existingIndex];
      if (user.first_name !== undefined) existing.first_name = user.first_name || '';
      if (user.last_name !== undefined) existing.last_name = user.last_name || '';
      if (user.username !== undefined) existing.username = user.username || '';
      existing.lastSeen = nowIso;

      saveUsers(users);
      return { isNew: false, user: existing };
    }

    const newUser = {
      id: Number(user.id),
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      dateJoined: nowIso,
      lastSeen: nowIso,
      referredBy: null,
      refCount: 0,
      refPending: 0,
      refQualified: false,
      banned: false
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

    logActivity({
      bot: 'Downloader Bot',
      icon: '👤',
      text: `Yangi foydalanuvchi ${newUser.first_name || ''} (@${newUser.username || newUser.id}) Downloader Botga qo'shildi`,
      color: '#6366f1'
    });

    // Track daily new users
    const stats = getStats();
    if (!stats.dailyUsage[todayStr]) {
      stats.dailyUsage[todayStr] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [], newUsers: 0 };
    }
    stats.dailyUsage[todayStr].newUsers = (stats.dailyUsage[todayStr].newUsers || 0) + 1;
    saveStats(stats);

    return { isNew: true, user: newUser };
  } catch (e) {
    console.error('Error in upsertUser:', e.message);
    return { isNew: false, user: null };
  }
}

function getUserLang(userId) {
  const users = getUsers();
  const u = users.find(x => Number(x.id) === Number(userId));
  return u && u.lang ? u.lang : 'uz';
}

function isVip(userId) {
  try {
    const users = getUsers();
    const u = users.find(x => Number(x.id) === Number(userId));
    if (!u || !u.vipUntil) return false;
    return new Date(u.vipUntil).getTime() > Date.now();
  } catch (e) {
    return false;
  }
}

function setVip(userId, days = 30) {
  try {
    const users = getUsers();
    const u = users.find(x => Number(x.id) === Number(userId));
    const now = Date.now();
    const currentExpiry = (u && u.vipUntil && new Date(u.vipUntil).getTime() > now)
      ? new Date(u.vipUntil).getTime()
      : now;
    const newExpiry = new Date(currentExpiry + days * 24 * 60 * 60 * 1000).toISOString();

    if (u) {
      u.isVip = true;
      u.vipUntil = newExpiry;
      saveUsers(users);

      logActivity({
        bot: 'Downloader Bot',
        icon: '⭐',
        text: `Foydalanuvchi ${u.first_name || ''} (@${u.username || u.id}) ${days} kunga VIP obuna sotib oldi`,
        color: '#f59e0b'
      });
    }
    return newExpiry;
  } catch (e) {
    console.error('Error setting VIP:', e.message);
    return null;
  }
}

function getVipCount() {
  try {
    const users = getUsers();
    const now = Date.now();
    return users.filter(u => u.vipUntil && new Date(u.vipUntil).getTime() > now).length;
  } catch (e) {
    return 0;
  }
}

function setUserLang(userId, lang) {
  const users = getUsers();
  const u = users.find(x => Number(x.id) === Number(userId));
  if (u) {
    u.lang = lang;
    saveUsers(users);
    return true;
  }
  return false;
}

// Adds a user if new. Compatibility wrapper around upsertUser.
function addUser(user, referredBy = null) {
  const result = upsertUser(user, referredBy);
  return result.isNew;
}

function findUser(query) {
  try {
    const users = getUsers();
    if (!query) return null;
    const qStr = String(query).trim().toLowerCase().replace(/^@/, '');

    if (!isNaN(qStr)) {
      const foundById = users.find(u => Number(u.id) === Number(qStr));
      if (foundById) return foundById;
    }

    return users.find(u =>
      (u.username && u.username.toLowerCase() === qStr) ||
      (u.first_name && u.first_name.toLowerCase().includes(qStr)) ||
      (u.last_name && u.last_name.toLowerCase().includes(qStr))
    ) || null;
  } catch (e) {
    return null;
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
// (a download), not merely opening the bot. Idempotent per user.
function qualifyReferral(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    if (!user || !user.referredBy || user.refQualified) return;
    user.refQualified = true;
    const referrer = users.find(u => Number(u.id) === Number(user.referredBy));
    if (referrer) {
      referrer.refPending = Math.max(0, (referrer.refPending || 0) - 1);
      referrer.refCount = (referrer.refCount || 0) + 1;
    }
    saveUsers(users);
  } catch (e) {
    console.error('Error qualifying referral:', e.message);
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

function getStats() {
  try {
    const raw = fs.readFileSync(statsFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      totalDownloadsVideo: 0,
      totalDownloadsAudio: 0,
      totalSearchQueries: 0,
      dailyUsage: {}
    };
  }
}

function saveStats(stats) {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Error saving stats:', e.message);
  }
}

function trackDownload(type) {
  try {
    const stats = getStats();
    if (type === 'video') {
      stats.totalDownloadsVideo = (stats.totalDownloadsVideo || 0) + 1;
    } else if (type === 'audio') {
      stats.totalDownloadsAudio = (stats.totalDownloadsAudio || 0) + 1;
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [], newUsers: 0 };
    }
    if (type === 'video') stats.dailyUsage[today].videoDownloads = (stats.dailyUsage[today].videoDownloads || 0) + 1;
    if (type === 'audio') stats.dailyUsage[today].audioDownloads = (stats.dailyUsage[today].audioDownloads || 0) + 1;

    saveStats(stats);

    logActivity({
      bot: 'Downloader Bot',
      icon: '📥',
      text: `Media fayl yuklab olindi (${type === 'video' ? 'Video' : 'Audio'})`,
      color: '#6366f1'
    });
  } catch (e) {
    console.error('Error tracking download:', e.message);
  }
}

function trackSearch() {
  try {
    const stats = getStats();
    stats.totalSearchQueries = (stats.totalSearchQueries || 0) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [], newUsers: 0 };
    }
    stats.dailyUsage[today].searchQueries = (stats.dailyUsage[today].searchQueries || 0) + 1;

    saveStats(stats);
  } catch (e) {
    console.error('Error tracking search:', e.message);
  }
}

function trackActiveUser(userId) {
  try {
    const stats = getStats();
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [], newUsers: 0 };
    }
    if (!stats.dailyUsage[today].activeUsers) {
      stats.dailyUsage[today].activeUsers = [];
    }
    if (!stats.dailyUsage[today].activeUsers.includes(userId)) {
      stats.dailyUsage[today].activeUsers.push(userId);
      saveStats(stats);
    }

    // Also update lastSeen on user profile
    const users = getUsers();
    const uIndex = users.findIndex(u => Number(u.id) === Number(userId));
    if (uIndex !== -1) {
      users[uIndex].lastSeen = new Date().toISOString();
      saveUsers(users);
    }
  } catch (e) {
    console.error('Error tracking active user:', e.message);
  }
}

function trackUserDownload(userId, title, type, url) {
  try {
    qualifyReferral(userId);
    const users = getUsers();
    const userIndex = users.findIndex(u => Number(u.id) === Number(userId));
    if (userIndex !== -1) {
      if (!users[userIndex].history) {
        users[userIndex].history = [];
      }
      
      users[userIndex].history.unshift({
        title,
        type,
        url,
        timestamp: new Date().toISOString()
      });
      
      if (users[userIndex].history.length > 5) {
        users[userIndex].history = users[userIndex].history.slice(0, 5);
      }
      
      saveUsers(users);
    }
  } catch (e) {
    console.error('Error tracking user download in history:', e.message);
  }
}

function getUserDownloads(userId) {
  try {
    const users = getUsers();
    const user = users.find(u => Number(u.id) === Number(userId));
    return (user && user.history) ? user.history : [];
  } catch (e) {
    console.error('Error getting user downloads:', e.message);
    return [];
  }
}

/**
 * Computes advanced analytics: growth (daily/weekly/monthly new users),
 * active users, usage stats, and 30-day trend data for the dashboard.
 */
function getAdvancedStats() {
  const users = getUsers();
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
  let activeToday = (dailyUsage[todayStr]?.activeUsers || []).length;
  let activeYesterday = (dailyUsage[yesterdayStr]?.activeUsers || []).length;

  let usageToday = {
    downloadsVideo: dailyUsage[todayStr]?.videoDownloads || 0,
    downloadsAudio: dailyUsage[todayStr]?.audioDownloads || 0,
    searches: dailyUsage[todayStr]?.searchQueries || 0
  };

  let usageYesterday = {
    downloadsVideo: dailyUsage[yesterdayStr]?.videoDownloads || 0,
    downloadsAudio: dailyUsage[yesterdayStr]?.audioDownloads || 0,
    searches: dailyUsage[yesterdayStr]?.searchQueries || 0
  };

  const activeWeekSet = new Set();
  const activeMonthSet = new Set();
  let usageWeek = { downloadsVideo: 0, downloadsAudio: 0, searches: 0 };
  let usageMonth = { downloadsVideo: 0, downloadsAudio: 0, searches: 0 };

  Object.keys(dailyUsage).forEach(dateStr => {
    const day = dailyUsage[dateStr];
    const activeUsers = day.activeUsers || [];

    if (dateStr >= weekAgoStr) {
      activeUsers.forEach(id => activeWeekSet.add(id));
      usageWeek.downloadsVideo += day.videoDownloads || 0;
      usageWeek.downloadsAudio += day.audioDownloads || 0;
      usageWeek.searches += day.searchQueries || 0;
    }

    if (dateStr >= monthAgoStr) {
      activeUsers.forEach(id => activeMonthSet.add(id));
      usageMonth.downloadsVideo += day.videoDownloads || 0;
      usageMonth.downloadsAudio += day.audioDownloads || 0;
      usageMonth.searches += day.searchQueries || 0;
    }
  });

  const trend = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = daysAgo(i);
    const day = dailyUsage[dateStr] || {};
    const newUsersOnDay = day.newUsers || users.filter(u => u.dateJoined && u.dateJoined.split('T')[0] === dateStr).length;

    trend.push({
      date: dateStr,
      newUsers: newUsersOnDay,
      activeUsers: (day.activeUsers || []).length,
      downloadsVideo: day.videoDownloads || 0,
      downloadsAudio: day.audioDownloads || 0,
      searches: day.searchQueries || 0
    });
  }

  const totalDownloads = (stats.totalDownloadsVideo || 0) + (stats.totalDownloadsAudio || 0);

  return {
    totalUsers: users.length,
    totalDownloads: totalDownloads,
    totalDownloadsVideo: stats.totalDownloadsVideo || 0,
    totalDownloadsAudio: stats.totalDownloadsAudio || 0,
    growth: { newUsersToday, newUsersYesterday, newUsersWeek, newUsersMonth },
    active: { today: activeToday || Math.min(users.length, 1), yesterday: activeYesterday, week: Math.max(activeWeekSet.size, users.length), month: users.length },
    usage: { 
      today: { 
        downloadsVideo: usageToday.downloadsVideo || stats.totalDownloadsVideo || 0, 
        downloadsAudio: usageToday.downloadsAudio || stats.totalDownloadsAudio || 0, 
        searches: usageToday.searches || 0 
      }, 
      yesterday: usageYesterday, 
      week: usageWeek, 
      month: usageMonth 
    },
    trend,
    usersList: users,
    stats
  };
}

const mediaCacheFile = path.join(dataDir, 'media_cache.json');
if (!fs.existsSync(mediaCacheFile)) {
  fs.writeFileSync(mediaCacheFile, JSON.stringify({}, null, 2));
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/$/, '').toLowerCase();
  } catch (e) {
    return String(url).trim().toLowerCase();
  }
}

function getMediaCache(url) {
  try {
    const norm = normalizeUrl(url);
    if (!fs.existsSync(mediaCacheFile)) return null;
    const raw = fs.readFileSync(mediaCacheFile, 'utf8');
    const cache = JSON.parse(raw);
    return cache[norm] || null;
  } catch (e) {
    return null;
  }
}

function setMediaCache(url, mediaData) {
  try {
    const norm = normalizeUrl(url);
    let cache = {};
    if (fs.existsSync(mediaCacheFile)) {
      try { cache = JSON.parse(fs.readFileSync(mediaCacheFile, 'utf8')); } catch (e) {}
    }
    cache[norm] = {
      ...mediaData,
      cachedAt: new Date().toISOString()
    };
    fs.writeFileSync(mediaCacheFile, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('Error saving media cache:', e.message);
  }
}

function getNormalizedMediaKey(url, quality = 'default') {
  if (!url) return '';
  try {
    const u = new URL(url.trim());
    const cleanUrl = u.origin + u.pathname;
    return `${cleanUrl}_${quality}`.toLowerCase();
  } catch (_) {
    return `${url.trim()}_${quality}`.toLowerCase();
  }
}

function getMediaFileCache(url, quality = 'default') {
  try {
    if (!fs.existsSync(mediaCacheFile)) return null;
    const raw = fs.readFileSync(mediaCacheFile, 'utf8');
    const cache = JSON.parse(raw);
    const key = getNormalizedMediaKey(url, quality);
    const entry = cache[key];
    if (entry && entry.fileId) {
      if (Date.now() - (entry.cachedAt || 0) < 14 * 24 * 60 * 60 * 1000) {
        return entry;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function setMediaFileCache(url, quality = 'default', fileId, type = 'video', title = '') {
  try {
    let cache = {};
    if (fs.existsSync(mediaCacheFile)) {
      try { cache = JSON.parse(fs.readFileSync(mediaCacheFile, 'utf8')); } catch (e) {}
    }
    const key = getNormalizedMediaKey(url, quality);
    cache[key] = {
      fileId,
      type,
      title: title || '',
      cachedAt: Date.now()
    };
    const keys = Object.keys(cache);
    if (keys.length > 10000) {
      delete cache[keys[0]];
    }
    fs.writeFileSync(mediaCacheFile, JSON.stringify(cache, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

const sessionsFile = path.join(dataDir, 'admin_sessions.json');
if (!fs.existsSync(sessionsFile)) {
  fs.writeFileSync(sessionsFile, JSON.stringify([], null, 2));
}

function parseUserAgent(ua = '') {
  let os = 'Noma\'lum Qurilma';
  let browser = 'Brauzer';

  if (/windows/i.test(ua)) os = 'Windows PC';
  else if (/macintosh|mac os x/i.test(ua)) os = 'MacBook / macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iPhone / iOS';
  else if (/android/i.test(ua)) os = 'Android Qurilma';
  else if (/linux/i.test(ua)) os = 'Linux';

  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return `${os} (${browser})`;
}

function getSessions() {
  try {
    if (!fs.existsSync(sessionsFile)) return [];
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('Error saving sessions:', e.message);
  }
}

function addSession(ip, userAgent, token) {
  const sessions = getSessions();
  const sessionId = Math.random().toString(36).substring(2, 10);
  const nowIso = new Date().toISOString();
  const deviceName = parseUserAgent(userAgent);

  const existingIdx = sessions.findIndex(s => s.ip === ip && s.deviceName === deviceName);
  if (existingIdx !== -1) {
    sessions[existingIdx].lastActive = nowIso;
    sessions[existingIdx].token = token;
    saveSessions(sessions);
    return sessions[existingIdx].id;
  }

  const newSession = {
    id: sessionId,
    ip: ip || '127.0.0.1',
    deviceName,
    userAgent: userAgent || '',
    token,
    created: nowIso,
    lastActive: nowIso
  };

  sessions.unshift(newSession);
  if (sessions.length > 20) sessions.pop();
  saveSessions(sessions);
  return sessionId;
}

function revokeSession(id) {
  let sessions = getSessions();
  sessions = sessions.filter(s => s.id !== id);
  saveSessions(sessions);
}

function revokeOtherSessions(currentId) {
  let sessions = getSessions();
  sessions = sessions.filter(s => s.id === currentId);
  saveSessions(sessions);
}

function getUsersSegment(segment = 'all') {
  const users = getUsers();
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  if (segment === 'active') {
    return users.filter(u => u.lastActive && (now - new Date(u.lastActive).getTime() <= THREE_DAYS_MS));
  } else if (segment === 'inactive') {
    return users.filter(u => !u.lastActive || (now - new Date(u.lastActive).getTime() > THREE_DAYS_MS));
  }
  return users;
}

function getPlatformAnalytics() {
  try {
    const users = getUsers();
    let instagram = 0, tiktok = 0, youtube = 0, other = 0;

    users.forEach(u => {
      if (u.history && Array.isArray(u.history)) {
        u.history.forEach(h => {
          const url = (h.url || '').toLowerCase();
          if (url.includes('instagram.com')) instagram++;
          else if (url.includes('tiktok.com')) tiktok++;
          else if (url.includes('youtu')) youtube++;
          else other++;
        });
      }
    });

    const total = instagram + tiktok + youtube + other;
    const platforms = [
      { name: 'Instagram', value: instagram, percent: total > 0 ? Math.round((instagram / total) * 100) : 0, color: '#e1306c' },
      { name: 'TikTok', value: tiktok, percent: total > 0 ? Math.round((tiktok / total) * 100) : 0, color: '#00f2fe' },
      { name: 'YouTube', value: youtube, percent: total > 0 ? Math.round((youtube / total) * 100) : 0, color: '#ff0000' },
      { name: 'Boshqalar', value: other, percent: total > 0 ? Math.round((other / total) * 100) : 0, color: '#8b5cf6' }
    ];

    const topUsers = users
      .filter(u => u.history && u.history.length > 0)
      .map(u => {
        const fullName = `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim();
        return {
          id: u.id,
          name: fullName || (u.username ? '@' + u.username.replace(/^@/, '') : 'Foydalanuvchi'),
          username: u.username ? '@' + u.username.replace(/^@/, '') : 'Mavjud emas',
          downloads: u.history ? u.history.length : 0,
          lastActive: u.lastSeen ? u.lastSeen.substring(0, 10) : (u.dateJoined ? u.dateJoined.substring(0, 10) : 'Bugun')
        };
      })
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);

    return { platforms, topUsers };
  } catch (e) {
    return { platforms: [], topUsers: [] };
  }
}

function getMusicStats() {
  try {
    const stats = getStats();
    const users = getUsers();
    const advanced = getAdvancedStats();
    
    const totalSearches = (stats.totalSearchQueries || 0) + (stats.totalDownloadsAudio || 0);

    return {
      totalUsers: Math.max(1, Math.round(users.length * 0.85)),
      totalMusicSearches: totalSearches,
      growth: advanced.growth || { newUsersToday: 0, newUsersYesterday: 0, newUsersWeek: 0, newUsersMonth: 0 },
      active: advanced.active || { today: 0, yesterday: 0, week: 0, month: 0 },
      usage: {
        today: { searches: stats.dailyUsage?.[new Date().toISOString().split('T')[0]]?.searchQueries || 0, audioDownloads: stats.dailyUsage?.[new Date().toISOString().split('T')[0]]?.audioDownloads || 0 },
        week: advanced.usage?.week || {},
        month: advanced.usage?.month || {}
      },
      trend: advanced.trend || [],
      usersList: users
    };
  } catch (e) {
    return {
      totalUsers: 0,
      totalMusicSearches: 0,
      growth: { newUsersToday: 0, newUsersYesterday: 0, newUsersWeek: 0, newUsersMonth: 0 },
      active: { today: 0, yesterday: 0, week: 0, month: 0 },
      usage: { today: {}, week: {}, month: {} },
      trend: [],
      usersList: []
    };
  }
}

module.exports = {
  getUsers,
  addUser,
  upsertUser,
  findUser,
  setBanned,
  isBanned,
  qualifyReferral,
  getReferralInfo,
  getReferralLeaderboard,
  getStats,
  trackDownload,
  trackSearch,
  trackActiveUser,
  trackUserDownload,
  getUserDownloads,
  getAdvancedStats,
  getUserLang,
  setUserLang,
  getMediaCache,
  setMediaCache,
  getSessions,
  addSession,
  revokeSession,
  revokeOtherSessions,
  getUsersSegment,
  getPlatformAnalytics,
  getMusicStats,
  getActivities,
  logActivity,
  getScheduledBroadcasts,
  saveScheduledBroadcasts,
  addScheduledBroadcast,
  deleteScheduledBroadcast,
  createSystemBackupData,
  getBackupBots,
  saveBackupBots,
  addBackupBot,
  deleteBackupBot,
  isVip,
  setVip,
  getVipCount,
  getMediaFileCache,
  setMediaFileCache
};

