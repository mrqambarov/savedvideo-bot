module.exports = {
  apps: [
    {
      name: 'vibeconvert-bot',
      script: './server/index.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'movie-bot',
      script: './movie-server/index.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        MOVIE_PORT: 5001
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};

