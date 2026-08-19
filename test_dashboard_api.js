const http = require('http');

async function testApi(round) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/admin/dashboard', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`[Round ${round}] Status: ${res.statusCode}, Website Stats:`, json.website_stats);
          if (json.website_stats && typeof json.website_stats.news === 'number') {
            resolve(true);
          } else {
            reject(new Error('Missing website_stats'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing Dashboard API on Production Server...');
  for (let i = 1; i <= 3; i++) {
    try {
      await testApi(i);
      console.log(`Round ${i} PASSED ✅`);
    } catch (e) {
      console.error(`Round ${i} FAILED ❌`, e);
      process.exit(1);
    }
  }
  console.log('All 3 rounds passed!');
}

run();
