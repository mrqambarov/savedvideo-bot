module.exports = {
  apps: [
    {
      name: 'movie-bot',
      script: './movie-server/index.js',
      cwd: __dirname,
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


