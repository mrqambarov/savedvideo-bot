module.exports = {
  apps: [
    {
      name: 'vibeconvert-bot',
      script: './server/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/vibeconvert-error.log',
      out_file: './logs/vibeconvert-out.log',
      merge_logs: true,
      max_size: '50M',
      retain: 5
    },
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
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/movie-bot-error.log',
      out_file: './logs/movie-bot-out.log',
      merge_logs: true,
      max_size: '50M',
      retain: 5
    },
    {
      name: 'adult-bot',
      script: './adult-server/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        ADULT_PORT: 5002
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/adult-bot-error.log',
      out_file: './logs/adult-bot-out.log',
      merge_logs: true,
      max_size: '50M',
      retain: 5
    },
    {
      name: 'guardian',
      script: './guardian/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      autorestart: true,
      restart_delay: 5000,       // 5 soniyada qayta tiklaydi
      max_restarts: 50,          // 50 marta urinadi
      watch: false,
      max_memory_restart: '200M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/guardian-error.log',
      out_file: './logs/guardian-out.log',
      merge_logs: true,
      max_size: '20M',
      retain: 3
    }
  ]
};

