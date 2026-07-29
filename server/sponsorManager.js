const fs = require('fs');
const path = require('path');

const channelsPath = path.join(__dirname, '..', 'channels.json');

function getChannels() {
  try {
    if (!fs.existsSync(channelsPath)) {
      return [];
    }
    const raw = fs.readFileSync(channelsPath, 'utf8');
    const channels = JSON.parse(raw);
    if (!Array.isArray(channels)) return [];

    return channels.map(c => ({
      id: c.id || `ch_${Math.random().toString(36).substring(2, 9)}`,
      username: String(c.username || '').trim(),
      link: String(c.link || '').trim(),
      targetCount: Number(c.targetCount) || 0, // 0 = unlimited target
      joinedCount: Number(c.joinedCount) || 0,
      joinedUsers: Array.isArray(c.joinedUsers) ? c.joinedUsers : [],
      dailyStats: c.dailyStats || {},
      monthlyStats: c.monthlyStats || {},
      active: c.active !== undefined ? Boolean(c.active) : true
    }));
  } catch (e) {
    console.error('Error reading channels.json:', e.message);
    return [];
  }
}

function saveChannels(channels) {
  try {
    fs.writeFileSync(channelsPath, JSON.stringify(channels, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving channels.json:', e.message);
    return false;
  }
}

function getActiveChannels() {
  const channels = getChannels();
  return channels.filter(c => c.active && (c.targetCount === 0 || c.joinedCount < c.targetCount));
}

function getActiveSponsorChannel() {
  const activeChannels = getActiveChannels();
  if (activeChannels.length === 0) return null;

  const epochDays = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const activeIndex = Math.floor(epochDays / 2) % activeChannels.length;
  const channel = activeChannels[activeIndex];

  let cleanUsername = channel.username.trim().replace(/\s+/g, '');
  if (cleanUsername.includes('t.me/')) {
    const parts = cleanUsername.split('t.me/');
    cleanUsername = '@' + parts[parts.length - 1].split('/')[0];
  } else if (!cleanUsername.startsWith('@')) {
    cleanUsername = '@' + cleanUsername;
  }

  return {
    id: channel.id,
    username: cleanUsername,
    link: channel.link || `https://t.me/${cleanUsername.replace('@', '')}`,
    targetCount: channel.targetCount,
    joinedCount: channel.joinedCount
  };
}

function recordMemberJoin(usernameOrId, userId) {
  const channels = getChannels();
  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const clean = String(usernameOrId).toLowerCase().replace(/^@/, '');
  const channel = channels.find(c =>
    c.id === usernameOrId ||
    c.username.toLowerCase().replace(/^@/, '') === clean
  );

  if (!channel) return { success: false, reason: 'Channel not found' };

  const uidStr = String(userId);
  if (!channel.joinedUsers.includes(uidStr)) {
    channel.joinedUsers.push(uidStr);
    channel.joinedCount = (channel.joinedCount || 0) + 1;
    channel.dailyStats[todayStr] = (channel.dailyStats[todayStr] || 0) + 1;
    channel.monthlyStats[monthStr] = (channel.monthlyStats[monthStr] || 0) + 1;

    if (channel.targetCount > 0 && channel.joinedCount >= channel.targetCount) {
      channel.active = false; // Auto-deactivate when target limit is reached
    }
    saveChannels(channels);
  }

  return {
    success: true,
    joinedCount: channel.joinedCount,
    targetCount: channel.targetCount,
    active: channel.active
  };
}

module.exports = {
  getChannels,
  saveChannels,
  getActiveChannels,
  getActiveSponsorChannel,
  recordMemberJoin
};
