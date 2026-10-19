const root = '/var/www/qinggai';
module.exports = {
  apps: [
    {
      name: 'qinggai-api',
      cwd: `${root}/current/apps/api`,
      script: `${root}/current/scripts/native-service.sh`,
      interpreter: '/bin/bash',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
      max_memory_restart: '384M',
      kill_timeout: 15000,
      out_file: `${root}/shared/logs/api.out.log`,
      error_file: `${root}/shared/logs/api.error.log`,
      time: true,
    },
  ],
};
