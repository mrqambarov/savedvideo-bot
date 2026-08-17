'use strict';
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', '..');

// Barcha kuzatiladigan JSON baza fayllari
const DB_FILES = [
  { name: 'server_users', path: path.join(BASE_DIR, 'server', 'data', 'users.json'), defaultContent: '[]' },
  { name: 'server_stats', path: path.join(BASE_DIR, 'server', 'data', 'stats.json'), defaultContent: '{"totalDownloadsVideo":0,"totalDownloadsAudio":0,"totalSearchQueries":0,"dailyUsage":{}}' },
  { name: 'movie_movies', path: path.join(BASE_DIR, 'movie-server', 'data', 'movies.json'), defaultContent: '[]' },
  { name: 'movie_users', path: path.join(BASE_DIR, 'movie-server', 'data', 'users.json'), defaultContent: '[]' },
  { name: 'channels', path: path.join(BASE_DIR, 'channels.json'), defaultContent: '[]' },
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
 * Xavfsiz `.bak` zaxira nusxasini yaratadi
 * @param {string} filePath 
 */
function createBackup(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const bakPath = `${filePath}.bak`;
    fs.copyFileSync(filePath, bakPath);
    return true;
  } catch (e) {
    console.error(`[DB Integrity] Zaxira olishda xato (${filePath}):`, e.message);
    return false;
  }
}

/**
 * Barcha baza fayllarini tekshiradi va sog'lom bo'lsa zaxira oladi
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
      createBackup(db.path);
    } else {
      console.warn(`[DB Integrity] ⚠️ Baza buzilgan: ${db.name} (${check.error})`);
    }
  }

  return results;
}

module.exports = { checkAllDatabases, validateJsonFile, DB_FILES };
