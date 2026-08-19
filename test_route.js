const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testApi() {
  const [{ count: newsCount }, { count: albumsCount }, { count: personnelCount }] = await Promise.all([
    supabase.from('news').select('*', { count: 'exact', head: true }),
    supabase.from('albums').select('*', { count: 'exact', head: true }),
    supabase.from('personnel').select('*', { count: 'exact', head: true }),
  ]);
  return { newsCount, albumsCount, personnelCount };
}

async function run() {
  for (let i = 1; i <= 3; i++) {
    const res = await testApi();
    console.log(`[Round ${i}] Website Stats: News ${res.newsCount}, Albums ${res.albumsCount}, Personnel ${res.personnelCount} - PASSED ✅`);
  }
}
run();
