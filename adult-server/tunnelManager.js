const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

let activeTunnelUrl = null;
let isStarting = false;

function ensureHttpsTunnel(port = 5002) {
  if (activeTunnelUrl) {
    return Promise.resolve(activeTunnelUrl);
  }
  if (isStarting) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (activeTunnelUrl) {
          clearInterval(interval);
          resolve(activeTunnelUrl);
        }
      }, 500);
    });
  }

  isStarting = true;
  return new Promise((resolve) => {
    console.log(`Establishing HTTPS tunnel for 18+ Mini App on port ${port}...`);

    localtunnel({ port })
      .then((tunnel) => {
        activeTunnelUrl = tunnel.url;
        console.log(`[Tunnel stdout]: your url is: ${activeTunnelUrl}`);
        console.log(`✅ Active HTTPS 18+ Mini App URL: ${activeTunnelUrl}`);

        updateEnvFile('ADULT_MINI_APP_URL', activeTunnelUrl);

        tunnel.on('close', () => {
          console.warn('18+ HTTPS Tunnel closed. Re-establishing in 5s...');
          activeTunnelUrl = null;
          isStarting = false;
          setTimeout(() => ensureHttpsTunnel(port), 5000);
        });

        tunnel.on('error', (err) => {
          console.error('18+ LocalTunnel error:', err.message);
          activeTunnelUrl = null;
          isStarting = false;
        });

        resolve(activeTunnelUrl);
      })
      .catch((err) => {
        console.error('Failed to create 18+ HTTPS localtunnel:', err.message);
        isStarting = false;
        resolve(process.env.ADULT_MINI_APP_URL || `http://localhost:${port}`);
      });
  });
}

function updateEnvFile(key, value) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes(`${key}=`)) {
      envContent = envContent.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    process.env[key] = value;
  } catch (e) {
    console.error('Error updating .env file with tunnel URL:', e.message);
  }
}

function getActiveTunnelUrl() {
  return activeTunnelUrl || process.env.ADULT_MINI_APP_URL || 'http://localhost:5002';
}

module.exports = {
  ensureHttpsTunnel,
  getActiveTunnelUrl
};
