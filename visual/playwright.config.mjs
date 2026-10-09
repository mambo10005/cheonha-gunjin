// Manual-only in a policy-approved environment. Not launched by npm test/build.
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'debate.visual.spec.mjs', fullyParallel: false, workers: 1,
  outputDir: '../verification/visual-results',
  use: { baseURL: 'http://127.0.0.1:5191', browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run visual:fixtures && npm run dev -- --host 127.0.0.1 --port 5191 --strictPort', cwd: fileURLToPath(new URL('..', import.meta.url)), url: 'http://127.0.0.1:5191', reuseExistingServer: false, timeout: 60000 },
  projects: [
    {name:'desktop', use:{viewport:{width:1600,height:900}}},
    {name:'laptop', use:{viewport:{width:1366,height:768}}},
    {name:'tablet', use:{viewport:{width:820,height:1180}}},
    {name:'mobile', use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ]
});
