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

module.exports = {
  getUsers,
  addUser,
  getStats,
  trackDownload,
  trackSearch,
  trackActiveUser,
  trackUserDownload,
  getUserDownloads
};
