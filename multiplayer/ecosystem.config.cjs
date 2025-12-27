const path = require('path');

module.exports = {
  apps: [{
    name: 'bigtwo',
    script: 'npx',
    args: 'tsx server/index.ts',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: path.join(__dirname, 'logs', 'error.log'),
    out_file: path.join(__dirname, 'logs', 'out.log'),
    log_file: path.join(__dirname, 'logs', 'combined.log'),
    time: true
  }]
};
