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

function addUser(user) {
  try {
    const users = getUsers();
    if (!users.some(u => Number(u.id) === Number(user.id))) {
      users.push({
        id: user.id,
        username: user.username || '',
        first_name: user.first_name || '',
        dateJoined: new Date().toISOString()
      });
      saveUsers(users);
    }
  } catch (e) {
    console.error('Error adding user:', e.message);
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
    
    // Track daily usage
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [] };
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
      stats.dailyUsage[today] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [] };
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
      stats.dailyUsage[today] = { videoDownloads: 0, audioDownloads: 0, searchQueries: 0, activeUsers: [] };
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

function trackUserDownload(userId, title, type, url) {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(u => Number(u.id) === Number(userId));
    if (userIndex !== -1) {
      if (!users[userIndex].history) {
        users[userIndex].history = [];
      }
      
      // Add recent download to the top
      users[userIndex].history.unshift({
        title,
        type, // 'audio' or 'video'
        url,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 5 items
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
 * active users, usage stats, and 14-day trend data for the dashboard.
 */
function getAdvancedStats() {
  const users = getUsers();
  const stats = getStats();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Helper: date string N days ago
  function daysAgo(n) {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  const weekAgoStr = daysAgo(7);
  const monthAgoStr = daysAgo(30);

  // Count new users by period
  let newUsersToday = 0, newUsersWeek = 0, newUsersMonth = 0;
  users.forEach(u => {
    if (!u.dateJoined) return;
    const joinDate = u.dateJoined.split('T')[0];
    if (joinDate === todayStr) newUsersToday++;
    if (joinDate >= weekAgoStr) newUsersWeek++;
    if (joinDate >= monthAgoStr) newUsersMonth++;
  });

  // Calculate active users and usage by period
  const dailyUsage = stats.dailyUsage || {};
  let activeToday = 0, activeWeek = 0, activeMonth = 0;
  let usageToday = { downloadsVideo: 0, downloadsAudio: 0, searches: 0 };
  let usageWeek = { downloadsVideo: 0, downloadsAudio: 0, searches: 0 };
  let usageMonth = { downloadsVideo: 0, downloadsAudio: 0, searches: 0 };

  // Collect unique active user sets for week and month
  const activeWeekSet = new Set();
  const activeMonthSet = new Set();

  Object.keys(dailyUsage).forEach(dateStr => {
    const day = dailyUsage[dateStr];
    const activeUsers = day.activeUsers || [];

    if (dateStr === todayStr) {
      activeToday = activeUsers.length;
      usageToday.downloadsVideo = day.videoDownloads || 0;
      usageToday.downloadsAudio = day.audioDownloads || 0;
      usageToday.searches = day.searchQueries || 0;
    }

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

  activeWeek = activeWeekSet.size;
  activeMonth = activeMonthSet.size;

  // Build 14-day trend data
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const dateStr = daysAgo(i);
    const day = dailyUsage[dateStr] || {};
    const newUsersOnDay = users.filter(u => u.dateJoined && u.dateJoined.split('T')[0] === dateStr).length;

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
    growth: { newUsersToday, newUsersWeek, newUsersMonth },
    active: { today: activeToday, week: activeWeek, month: activeMonth },
    usage: { today: usageToday, week: usageWeek, month: usageMonth },
    trend,
    usersList: users,
    stats
  };
}

module.exports = {
  getUsers,
  addUser,
  getStats,
  trackDownload,
  trackSearch,
  trackActiveUser,
  trackUserDownload,
  getUserDownloads,
  getAdvancedStats
};
