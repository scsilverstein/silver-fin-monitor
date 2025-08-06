// PM2 ecosystem configuration for Silver Fin Monitor
module.exports = {
  apps: [
    {
      // Main API Server
      name: 'silver-fin-api',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      // Health check
      cron_restart: '0 2 * * *', // Restart daily at 2 AM
    },
    {
      // Feed Processor Worker
      name: 'silver-fin-worker',
      script: './dist/services/workers/feed-processor.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      // Don't cluster workers to avoid job conflicts
    },
    {
      // Optional: Separate Analysis Worker
      name: 'silver-fin-analysis',
      script: './dist/services/workers/analysis.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/analysis-error.log',
      out_file: './logs/analysis-out.log',
      log_file: './logs/analysis-combined.log',
      time: true,
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      cron_restart: '0 6 * * *', // Restart at 6 AM for daily analysis
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/silver-fin-monitor.git',
      path: '/var/www/silver-fin-monitor',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    },
    staging: {
      user: 'deploy',
      host: 'staging.your-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/silver-fin-monitor.git',
      path: '/var/www/silver-fin-monitor-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};