'use strict';
const fs = require('fs');
const { validateJsonFile } = require('../checks/dbIntegrityCheck');
const { sendAlert, sendCriticalAlert } = require('./alerter');

/**
 * Buzilgan baza faylini zaxiradan (.bak) tiklaydi yoki toza holatda yaratadi
 * @param {string} name - Baza nomi
 * @param {string} filePath - Asl fayl yo'li
 * @param {string} defaultContent - Zaxira ham bo'lmasa yaratiladigan boshlang'ich JSON
 * @returns {Promise<boolean>}
 */
async function healDatabase(name, filePath, defaultContent = '[]') {
  console.log(`[DB Healer] "${name}" bazasini avtomatik tiklash boshlandi...`);

  const bakPath = `${filePath}.bak`;
  let restoredFromBak = false;

  // 1. Avval .bak nusxasi borligini va to'g'riligini tekshiramiz
  if (fs.existsSync(bakPath)) {
    const bakCheck = validateJsonFile(bakPath);
    if (bakCheck.valid) {
      try {
        fs.copyFileSync(bakPath, filePath);
        restoredFromBak = true;
        console.log(`[DB Healer] "${name}" .bak zaxira nusxasidan muvaffaqiyatli tiklandi!`);
      } catch (e) {
        console.error(`[DB Healer] Nusxalashda xato:`, e.message);
      }
    }
  }

  // 2. Agar .bak bo'lmasa yoki u ham buzilgan bo'lsa, defaultContent bilan yaratamiz
  if (!restoredFromBak) {
    try {
      fs.writeFileSync(filePath, defaultContent, 'utf8');
      console.log(`[DB Healer] "${name}" boshlang'ich toza holatda qayta yaratildi.`);
    } catch (e) {
      console.error(`[DB Healer] Fayl yaratishda xato:`, e.message);
      await sendCriticalAlert(`DB Auto-Heal Failed (${name})`, e.message);
      return false;
    }
  }

  // 3. Adminga xabar berish
  const healMethod = restoredFromBak ? 'Oxirgi avto-zaxira (.bak) orqali' : 'Toza boshlang\'ich holatda';
  await sendAlert(
    `🩹 <b>Baza buzilganligi aniqlandi va o'zini o'zi tikladi!</b>\n\n` +
    `• Baza: <code>${name}</code>\n` +
    `• Tiklash usuli: <b>${healMethod}</b>\n` +
    `• Tizim: <b>Xatosiz ishlashda davom etmoqda</b>`,
    `db_heal_${name}`,
    'warn'
  );

  return true;
}

module.exports = { healDatabase };
