const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const emails = [
  'aiza@somkidvittaya.ac.th',
  'atipa@somkidvittaya.ac.th',
  'daisy@somkidvittaya.ac.th',
  'donnah@somkidvittaya.ac.th',
  'el@somkidvittaya.ac.th',
  'ericka@somkidvittaya.ac.th',
  'jenjira@somkidvittaya.ac.th',
  'jessada@somkidvittaya.ac.th',
  'kamonchanok@somkidvittaya.ac.th',
  'kwanjai@somkidvittaya.ac.th',
  'kwanyuen@somkidvittaya.ac.th',
  'maliwan@somkidvittaya.ac.th',
  'marineln@somkidvittaya.ac.th',
  'media@somkidvittaya.ac.th',
  'mekhala@somkidvittaya.ac.th',
  'napussorn@somkidvittaya.ac.th',
  'nattawat@somkidvittaya.ac.th',
  'natthaya@somkidvittaya.ac.th',
  'pattarakan@somkidvittaya.ac.th',
  'peerawat@somkidvittaya.ac.th',
  'phinyapach@somkidvittaya.ac.th',
  'pornphilai@somkidvittaya.ac.th',
  'saovaros@somkidvittaya.ac.th',
  'saowakhon@somkidvittaya.ac.th',
  'thanawadee@somkidvittaya.ac.th',
  'thiptarkool@somkidvittaya.ac.th',
  'usa@somkidvittaya.ac.th',
  'wareerak@somkidvittaya.ac.th'
];

async function addTeachers() {
  console.log(`Starting to add ${emails.length} users...`);

  // Get all existing users to avoid errors
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error fetching auth users:', authError);
    return;
  }

  for (const email of emails) {
    let userId;
    const existingUser = users.find(u => u.email === email);
    
    if (existingUser) {
      console.log(`[${email}] Auth user already exists (${existingUser.id}).`);
      userId = existingUser.id;
    } else {
      console.log(`[${email}] Creating new auth user...`);
      const { data: userResponse, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: Math.random().toString(36).slice(-8) + 'A1!', // Temporary password (they use Google anyway)
        email_confirm: true,
        user_metadata: { full_name: email.split('@')[0] }
      });
      
      if (createError) {
        console.error(`[${email}] Failed to create auth user:`, createError.message);
        continue;
      }
      userId = userResponse.user.id;
      console.log(`[${email}] Created auth user: ${userId}`);
    }

    // Now upsert into app_users
    console.log(`[${email}] Upserting into app_users...`);
    const { error: dbError } = await supabase.from('app_users').upsert({
      id: userId,
      full_name: email.split('@')[0],
      role: 'admin',
      is_active: true
    }, { onConflict: 'id' });

    if (dbError) {
      console.error(`[${email}] Failed to upsert app_users:`, dbError.message);
    } else {
      console.log(`[${email}] Success!`);
    }
  }
  console.log('All done!');
}

addTeachers();
