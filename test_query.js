const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('Testing query...');
  const { data, error } = await supabase
    .from('students')
    .select('*, student_addresses(*), student_parents(*)')
    .limit(5);
  
  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Query success! Found rows:', data.length);
    if (data.length > 0) {
      console.log('Sample:', JSON.stringify(data[0], null, 2));
    }
  }
}
test();
