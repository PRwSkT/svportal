const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listUsers() {
  const { data, error } = await supabase.from('app_users').select('*');
  console.log('App Users:', data);
  if (data && data.length > 0) {
    console.log('Updating all to admin...');
    const { error: updateError } = await supabase.from('app_users').update({ role: 'admin' }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (!updateError) console.log('Successfully updated roles to admin.');
  }
}
listUsers();
