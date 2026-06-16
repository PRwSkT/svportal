const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUsers() {
  console.log('Fetching all auth users...');
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error fetching auth users:', authError);
    return;
  }
  
  console.log(`Found ${users.length} auth users.`);
  
  for (const user of users) {
    console.log(`Checking app_users for ${user.email} (${user.id})...`);
    const { data: existing, error } = await supabase.from('app_users').select('id').eq('id', user.id).single();
    
    if (!existing) {
      console.log(`User ${user.email} missing in app_users! Inserting as admin...`);
      const { error: insertError } = await supabase.from('app_users').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email,
        role: 'admin',
        is_active: true
      });
      if (insertError) {
        console.error('Error inserting:', insertError);
      } else {
        console.log(`Successfully inserted ${user.email} into app_users.`);
      }
    } else {
      console.log(`User ${user.email} already in app_users. Updating to admin just in case...`);
      await supabase.from('app_users').update({ role: 'admin' }).eq('id', user.id);
    }
  }
  console.log('Done!');
}

fixUsers();
