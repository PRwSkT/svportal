const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('student_addresses').select('*').eq('student_id', '10263');
  console.log('ADDRESSES:', data);
  const { data: pData } = await supabase.from('student_parents').select('*').eq('student_id', '10263');
  console.log('PARENTS:', pData);
}
run();
