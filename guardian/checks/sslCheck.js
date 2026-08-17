'use strict';
const tls = require('tls');

const SSL_WARN_DAYS = 14;  // 14 kundan kam qolsa ogohlantirish
const SSL_CRIT_DAYS = 3;   // 3 kundan kam qolsa kritik

/**
 * Domain ning SSL sertifikat muddatini tekshiradi
 * @param {string} hostname - Domain nomi (masalan 'xitfilm.uz')
 * @param {number} port - Port (odatda 443)
 * @returns {Promise<{ ok: boolean, daysLeft: number, expiresOn: string, error?: string }>}
 */
function checkSSLCert(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (!cert || !cert.valid_to) {
            return resolve({ ok: false, daysLeft: 0, error: 'Sertifikat ma\'lumotlari olinmadi' });
          }

          const expiresOn = new Date(cert.valid_to);
          const daysLeft = Math.floor((expiresOn - Date.now()) / 86400000);
          const ok = daysLeft > SSL_CRIT_DAYS;

          resolve({
            ok,
            daysLeft,
            expiresOn: expiresOn.toISOString().split('T')[0],
            warn: daysLeft <= SSL_WARN_DAYS,
            critical: daysLeft <= SSL_CRIT_DAYS
          });
        } catch (err) {
          socket.destroy();
          resolve({ ok: false, daysLeft: 0, error: err.message });
        }
      }
    );

    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ ok: false, daysLeft: 0, error: 'SSL tekshiruvida timeout' });
    });

    socket.on('error', (err) => {
      resolve({ ok: false, daysLeft: 0, error: err.message });
    });
  });
}

/**
 * Barcha domenlarning SSL sertifikatlarini tekshiradi
 * @param {Array<string>} domains
 */
async function checkAllSSL(domains) {
  const results = new Map();
  await Promise.all(domains.map(async (domain) => {
    const result = await checkSSLCert(domain);
    results.set(domain, result);

    const log = result.error
      ? `✗ ${domain}: ${result.error}`
      : `${result.ok ? '✓' : '⚠'} ${domain}: ${result.daysLeft} kun qoldi (${result.expiresOn} tugaydi)`;
    console.log(`[Guardian SSL] ${log}`);
  }));
  return results;
}

module.exports = { checkSSLCert, checkAllSSL, SSL_WARN_DAYS, SSL_CRIT_DAYS };
