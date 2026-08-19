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

function normalizeChannelIdentifier(input) {
  if (!input) return '';
  let str = String(input).trim();
  if (str.includes('t.me/')) {
    const parts = str.split('t.me/');
    str = parts[parts.length - 1].split('/')[0].split('?')[0];
  }
  return str.toLowerCase().replace(/^@/, '');
}

function recordChannelCheck(usernameOrId) {
  try {
    const channels = getChannels();
    const clean = normalizeChannelIdentifier(usernameOrId);
    let updated = false;

    channels.forEach(c => {
      const cIdClean = normalizeChannelIdentifier(c.id);
      const cUserClean = normalizeChannelIdentifier(c.username);
      if (c.id === usernameOrId || cIdClean === clean || cUserClean === clean) {
        c.checksCount = (Number(c.checksCount) || Number(c.joinedCount) || 0) + 1;
        updated = true;
      }
    });

    if (updated) {
      saveChannels(channels);
      return true;
    }
  } catch (e) {
    console.error('Error recording channel check:', e.message);
  }
  return false;
}

function recordMemberJoin(usernameOrId, userId) {
  const channels = getChannels();
  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const clean = normalizeChannelIdentifier(usernameOrId);
  const channel = channels.find(c =>
    c.id === usernameOrId ||
    normalizeChannelIdentifier(c.id) === clean ||
    normalizeChannelIdentifier(c.username) === clean
  );

  if (!channel) return { success: false, reason: 'Channel not found' };

  if (!Array.isArray(channel.joinedUsers)) channel.joinedUsers = [];
  if (!channel.dailyStats) channel.dailyStats = {};
  if (!channel.monthlyStats) channel.monthlyStats = {};

  const uidStr = String(userId);
  if (!channel.joinedUsers.includes(uidStr)) {
    channel.joinedUsers.push(uidStr);
    channel.joinedCount = channel.joinedUsers.length;
    channel.checksCount = Math.max(Number(channel.checksCount) || 0, channel.joinedCount);
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

function getSponsorStats() {
  const rawChannels = getChannels();
  let totalJoined = 0;
  let totalChecks = 0;

  const formattedChannels = rawChannels.map((ch, idx) => {
    const joined = Number(ch.joinedCount) || (Array.isArray(ch.joinedUsers) ? ch.joinedUsers.length : 0);
    const checks = Math.max(Number(ch.checksCount) || joined || 0, joined);
    totalJoined += joined;
    totalChecks += checks;

    const passRate = checks > 0 ? Math.min(100, Math.round((joined / checks) * 100)) : (joined > 0 ? 100 : 0);
    let displayName = ch.username || ch.title || `Kanal #${idx + 1}`;
    if (!displayName.startsWith('@') && !displayName.includes(' ')) displayName = '@' + displayName;

    return {
      id: ch.id || `ch_${idx + 1}`,
      name: displayName,
      link: ch.link || (ch.username ? `https://t.me/${ch.username.replace('@', '')}` : '#'),
      joinedCount: joined,
      targetCount: ch.targetCount || 0,
      checks: checks,
      passRate: passRate,
      active: ch.active !== false
    };
  });

  const conversionRate = totalChecks > 0 ? Math.min(100, Math.round((totalJoined / totalChecks) * 100)) : (totalJoined > 0 ? 100 : 0);

  return {
    totalChecks: Math.max(totalChecks, totalJoined),
    subscribedCount: totalJoined,
    conversionRate: conversionRate,
    channels: formattedChannels
  };
}

module.exports = {
  getChannels,
  saveChannels,
  getActiveChannels,
  getActiveSponsorChannel,
  recordChannelCheck,
  recordMemberJoin,
  getSponsorStats
};
