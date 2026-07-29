const { spawn } = require('child_process');
const path = require('path');

let activeTunnelUrl = null;
let tunnelProcess = null;

/**
 * Ensures an active HTTPS tunnel URL for Telegram Mini App
 * @param {number} port
 * @returns {Promise<string>} Live HTTPS URL
 */
function ensureHttpsTunnel(port = 5001) {
  return new Promise((resolve) => {
    // If env already has custom HTTPS domain (e.g. Nginx or Cloudflare domain), use it
    if (process.env.MOVIE_MINI_APP_URL && process.env.MOVIE_MINI_APP_URL.startsWith('https://') && !process.env.MOVIE_MINI_APP_URL.includes('vercel.app')) {
      activeTunnelUrl = process.env.MOVIE_MINI_APP_URL;
      console.log('Using configured HTTPS domain:', activeTunnelUrl);
      return resolve(activeTunnelUrl);
    }

    console.log(`Establishing HTTPS tunnel for Telegram Mini App on port ${port}...`);

    // Try localtunnel via npx
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    
    try {
      tunnelProcess = spawn(cmd, ['-y', 'localtunnel', '--port', String(port)]);

      let resolved = false;

      tunnelProcess.stdout.on('data', (data) => {
        const str = data.toString();
        console.log('[Tunnel stdout]:', str.trim());
        const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/);
        if (match && !resolved) {
          resolved = true;
          activeTunnelUrl = match[0];
          process.env.MOVIE_MINI_APP_URL = activeTunnelUrl;
          console.log('✅ Active HTTPS Telegram Mini App URL:', activeTunnelUrl);
          resolve(activeTunnelUrl);
        }
      });

      tunnelProcess.stderr.on('data', (data) => {
        const str = data.toString();
        const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/);
        if (match && !resolved) {
          resolved = true;
          activeTunnelUrl = match[0];
          process.env.MOVIE_MINI_APP_URL = activeTunnelUrl;
          console.log('✅ Active HTTPS Telegram Mini App URL:', activeTunnelUrl);
          resolve(activeTunnelUrl);
        }
      });

      tunnelProcess.on('error', (err) => {
        console.error('Tunnel process error:', err.message);
        if (!resolved) {
          resolved = true;
          resolve(process.env.MOVIE_MINI_APP_URL || 'http://localhost:5001');
        }
      });

      // Timeout safety after 10s
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const fallback = activeTunnelUrl || process.env.MOVIE_MINI_APP_URL || 'http://localhost:5001';
          resolve(fallback);
        }
      }, 10000);

    } catch (e) {
      console.error('Failed to spawn tunnel process:', e.message);
      resolve(process.env.MOVIE_MINI_APP_URL || 'http://localhost:5001');
    }
  });
}

function getActiveTunnelUrl() {
  return activeTunnelUrl || process.env.MOVIE_MINI_APP_URL || 'http://localhost:5001';
}

module.exports = {
  ensureHttpsTunnel,
  getActiveTunnelUrl
};
