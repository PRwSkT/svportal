const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('news').select('id').limit(1);
  if (error) {
    console.error('Connection failed:', error.message);
    process.exit(1);
  } else {
    console.log('Connection successful! Found news items:', data.length);
  }
}
test();
