module.exports = {
  apps: [{
    name: 'bigtwo',
    script: 'npx',
    args: 'tsx server/index.ts',
    cwd: '/home/runcloud/webapps/bigtwo',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
