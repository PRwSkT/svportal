const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) {
    console.error(`Error fetching ${table}:`, error.message);
  } else {
    console.log(`Table ${table} sample:`, data[0] || 'Empty table');
  }
}

async function run() {
  await checkTable('personnel');
  await checkTable('news');
  await checkTable('albums');
  await checkTable('album_photos');
  await checkTable('calendar_events');
  await checkTable('documents');
}
run();
