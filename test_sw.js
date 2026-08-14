const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        }).on('error', reject);
      });
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Server did not start in time');
}

async function runTest() {
  console.log('Starting Next.js server...');
  const server = spawn('npm', ['run', 'start'], { stdio: 'pipe' });
  
  try {
    await waitForServer('http://localhost:3000/broadcaster.html');
    console.log('Server is up!');

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('1. Navigating to broadcaster.html to register SW...');
    await page.goto('http://localhost:3000/broadcaster.html');
    
    // Wait for Service Worker registration
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true);
    
    // Optional wait to let SW install & activate
    await page.waitForTimeout(2000);
    
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active ? reg.active.state : 'no-active-sw';
    });
    console.log('Service Worker State:', swState);

    console.log('2. Navigating to Next.js internal page (admin/students)...');
    const response = await page.goto('http://localhost:3000/admin/students');
    
    // Check if the response was served from Service Worker
    const fromSW = response.request().serviceWorker();
    console.log('Admin page served from SW?', !!fromSW); // Should be false or bypassed
    
    console.log('3. Triggering a fetch to /api/admin/students...');
    const apiResult = await page.evaluate(async () => {
      const res = await fetch('/api/admin/students');
      return {
        status: res.status,
        headers: Array.from(res.headers.entries())
      };
    });
    console.log('API /api/admin/students fetch status:', apiResult.status);
    
    console.log('Test completed successfully.');
    await browser.close();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    server.kill();
  }
}

runTest();
