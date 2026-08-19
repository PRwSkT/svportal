const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_policies');
  if (error) {
    console.log("Cannot use RPC, trying direct pg_policies query via REST is not possible, let's use the postgres connection if possible or just create a script using pg");
  } else {
    console.log(data);
  }
}
check();
