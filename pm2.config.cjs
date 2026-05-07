module.exports = {
  apps: [
    {
      name: 'sawyer-server',
      script: 'node_modules/.bin/tsx',
      args: 'server.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Ensure it restarts if it crashes
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
