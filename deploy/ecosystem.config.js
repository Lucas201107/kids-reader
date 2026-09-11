// PM2 进程守护配置
// 用法：pm2 start deploy/ecosystem.config.js && pm2 save
//
// 注意：数据库默认是 SQLite，必须用 fork 单进程（exec_mode: 'fork'）。
// 若已切换为 MySQL，可以改成 cluster + instances: 'max' 提升并发。
module.exports = {
  apps: [
    {
      name: 'kids-reader',
      script: 'dist/src/main.js',
      cwd: '/opt/kids-reader/server',

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      error_file: '/var/log/kids-reader/error.log',
      out_file: '/var/log/kids-reader/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
