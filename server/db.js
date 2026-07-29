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

    // Track daily new users
    const stats = getStats();
    if (!stats.dailyUsage[todayStr]) {
      stats.dailyUsage[todayStr] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [], newUsers: 0 };
    }
function getUserLang(userId) {
  const users = getUsers();
  const u = users.find(x => Number(x.id) === Number(userId));
  return u && u.lang ? u.lang : 'uz';
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

  return {
    totalUsers: users.length,
    growth: { newUsersToday, newUsersYesterday, newUsersWeek, newUsersMonth },
    active: { today: activeToday, yesterday: activeYesterday, week: activeWeekSet.size, month: activeMonthSet.size },
    usage: { today: usageToday, yesterday: usageYesterday, week: usageWeek, month: usageMonth },
    trend,
    usersList: users,
    stats
  };
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
  setUserLang
};
