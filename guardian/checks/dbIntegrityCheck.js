'use strict';
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', '..');

// Barcha kuzatiladigan JSON baza fayllari (Downloader, Kino, 18+ Adult va Kanallar)
const DB_FILES = [
  // Downloader Bot
  { name: 'server_users', path: path.join(BASE_DIR, 'server', 'data', 'users.json'), defaultContent: '[]' },
  { name: 'server_stats', path: path.join(BASE_DIR, 'server', 'data', 'stats.json'), defaultContent: '{"totalDownloadsVideo":0,"totalDownloadsAudio":0,"totalSearchQueries":0,"dailyUsage":{}}' },
  { name: 'server_activities', path: path.join(BASE_DIR, 'server', 'data', 'activities.json'), defaultContent: '[]' },
  { name: 'server_backup_bots', path: path.join(BASE_DIR, 'server', 'data', 'backup_bots.json'), defaultContent: '[]' },

  // Movie Bot
  { name: 'movie_movies', path: path.join(BASE_DIR, 'movie-server', 'data', 'movies.json'), defaultContent: '[]' },
  { name: 'movie_users', path: path.join(BASE_DIR, 'movie-server', 'data', 'users.json'), defaultContent: '[]' },
  { name: 'movie_stats', path: path.join(BASE_DIR, 'movie-server', 'data', 'stats.json'), defaultContent: '{"totalViews":0,"totalSearchQueries":0,"dailyUsage":{}}' },
  { name: 'movie_genres', path: path.join(BASE_DIR, 'movie-server', 'data', 'genres.json'), defaultContent: '["Premyera","Jangari","Komediya","Drama","Fantastika","Triller","Multfilm","Tarixiy"]' },
  { name: 'movie_partners', path: path.join(BASE_DIR, 'movie-server', 'data', 'partner_channels.json'), defaultContent: '[]' },
  { name: 'movie_requests', path: path.join(BASE_DIR, 'movie-server', 'data', 'requests.json'), defaultContent: '[]' },
  { name: 'movie_shorts', path: path.join(BASE_DIR, 'movie-server', 'data', 'shorts.json'), defaultContent: '[]' },

  // 18+ Adult Bot
  { name: 'adult_movies', path: path.join(BASE_DIR, 'adult-server', 'data', 'movies.json'), defaultContent: '[]' },
  { name: 'adult_users', path: path.join(BASE_DIR, 'adult-server', 'data', 'users.json'), defaultContent: '[]' },
  { name: 'adult_stats', path: path.join(BASE_DIR, 'adult-server', 'data', 'stats.json'), defaultContent: '{"totalViews":0,"totalSearchQueries":0,"dailyUsage":{}}' },
  { name: 'adult_channels', path: path.join(BASE_DIR, 'adult-server', 'data', 'channels.json'), defaultContent: '[]' },
  { name: 'adult_genres', path: path.join(BASE_DIR, 'adult-server', 'data', 'genres.json'), defaultContent: '["Triller (18+)","Qo\'rqinchli (Horror 18+)","Jangari (18+)","Psixologik (18+)","Dokumental (18+)","Sarguzasht (18+)"]' },
  { name: 'adult_join_requests', path: path.join(BASE_DIR, 'adult-server', 'data', 'join_requests.json'), defaultContent: '[]' },

  // Global Kanallar
  { name: 'global_channels', path: path.join(BASE_DIR, 'channels.json'), defaultContent: '[]' },
];

/**
 * Fayl mavjudligini va to'g'ri JSON ekanligini tekshiradi
 * @param {string} filePath 
 * @returns {{ valid: boolean, sizeBytes: number, error?: string }}
 */
function validateJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, sizeBytes: 0, error: 'Fayl mavjud emas' };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content || content.trim() === '') {
      return { valid: false, sizeBytes: 0, error: 'Fayl bo\'sh' };
    }
    JSON.parse(content);
    const stat = fs.statSync(filePath);
    return { valid: true, sizeBytes: stat.size };
  } catch (err) {
    return { valid: false, sizeBytes: 0, error: `JSON parse xatosi: ${err.message}` };
  }
}

/**
 * Ko'p bosqichli aylanma zaxira (.bak -> .bak.1 -> .bak.2 -> .bak.3) yaratadi
 * @param {string} filePath 
 * @param {number} maxVersions
 */
function createRollingBackup(filePath, maxVersions = 3) {
  try {
    if (!fs.existsSync(filePath)) return false;

    // Eng eski versiyadan boshlab surish (rotation)
    for (let i = maxVersions - 1; i >= 1; i--) {
      const src = `${filePath}.bak.${i}`;
      const dst = `${filePath}.bak.${i + 1}`;
      if (fs.existsSync(src)) {
        try { fs.copyFileSync(src, dst); } catch (_) {}
      }
    }

    // .bak -> .bak.1
    const bakMain = `${filePath}.bak`;
    if (fs.existsSync(bakMain)) {
      try { fs.copyFileSync(bakMain, `${filePath}.bak.1`); } catch (_) {}
    }

    // Asosiy faylni .bak ga nusxalash
    fs.copyFileSync(filePath, bakMain);
    return true;
  } catch (e) {
    console.error(`[DB Integrity] Aylanma zaxira olishda xato (${filePath}):`, e.message);
    return false;
  }
}

/**
 * Barcha baza fayllarini tekshiradi va sog'lom bo'lsa aylanma zaxira oladi
 * @returns {Promise<Map<string, { valid: boolean, path: string, sizeBytes: number, error?: string }>>}
 */
async function checkAllDatabases() {
  const results = new Map();

  for (const db of DB_FILES) {
    const check = validateJsonFile(db.path);
    results.set(db.name, {
      ...check,
      path: db.path,
      defaultContent: db.defaultContent
    });

    if (check.valid) {
      createRollingBackup(db.path);
    } else {
      console.warn(`[DB Integrity] ⚠️ Baza buzilgan: ${db.name} (${check.error})`);
    }
  }

  return results;
}

module.exports = { checkAllDatabases, validateJsonFile, createRollingBackup, DB_FILES };

