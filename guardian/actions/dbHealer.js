'use strict';
const fs = require('fs');
const path = require('path');
const { validateJsonFile } = require('../checks/dbIntegrityCheck');
const { sendAlert, sendCriticalAlert } = require('./alerter');

/**
 * Buzilgan baza faylini ko'p bosqichli zaxiradan (.bak, .bak.1, .bak.2, .bak.3) tiklaydi yoki toza holatda yaratadi
 * @param {string} name - Baza nomi
 * @param {string} filePath - Asl fayl yo'li
 * @param {string} defaultContent - Zaxira ham bo'lmasa yaratiladigan boshlang'ich JSON
 * @returns {Promise<boolean>}
 */
async function healDatabase(name, filePath, defaultContent = '[]') {
  console.log(`[DB Healer] "${name}" bazasini avtomatik tiklash boshlandi...`);

  const candidateBackups = [
    `${filePath}.bak`,
    `${filePath}.bak.1`,
    `${filePath}.bak.2`,
    `${filePath}.bak.3`
  ];

  let restoredFrom = null;

  // 1. Zaxira nusxalarini navbatma-navbat tekshirib tiklash
  for (const bakPath of candidateBackups) {
    if (fs.existsSync(bakPath)) {
      const bakCheck = validateJsonFile(bakPath);
      if (bakCheck.valid) {
        try {
          fs.copyFileSync(bakPath, filePath);
          restoredFrom = path.basename(bakPath);
          console.log(`[DB Healer] "${name}" ${restoredFrom} zaxira nusxasidan muvaffaqiyatli tiklandi!`);
          break;
        } catch (e) {
          console.error(`[DB Healer] Nusxalashda xato (${bakPath}):`, e.message);
        }
      }
    }
  }

  // 2. Agar barcha zaxiralar buzilgan yoki yo'q bo'lsa, defaultContent bilan yaratamiz
  if (!restoredFrom) {
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
  const healMethod = restoredFrom ? `Avto-zaxira (${restoredFrom}) orqali` : 'Toza boshlang\'ich holatda';
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

