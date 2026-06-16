const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('Fetching students...');
  const { data, error } = await supabase
    .from('students')
    .select('*, student_addresses(*), student_parents(*)')
    .order('id', { ascending: true });
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Fetched ${data.length} students`);
    // Find duplicates
    const ids = data.map(d => d.id);
    const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
    if (duplicates.length > 0) {
      console.log('Duplicates found:', duplicates.length);
    }
  }
}
test();
