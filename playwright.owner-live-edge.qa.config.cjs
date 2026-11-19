const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 75000,
  use: { baseURL: 'http://127.0.0.1:5301', browserName: 'chromium', channel: 'msedge', headless: true, screenshot: 'only-on-failure' },
  projects: [{ name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } }]
});
