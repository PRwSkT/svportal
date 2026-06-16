const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Use anon key, simulating client/proxy
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@svportal.com',
    password: '1234'
  });

  if (authError) {
    console.error('Login error:', authError);
    return;
  }
  
  console.log('Logged in as:', authData.user.id);
  
  const { data: role, error: rpcError } = await supabase.rpc('get_user_role');
  console.log('Role:', role, 'Error:', rpcError);
}
test();
