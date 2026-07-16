module.exports = {
  apps: [{
    name: 'leland-app',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};