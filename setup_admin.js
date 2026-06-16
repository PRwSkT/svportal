const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAdmin() {
  console.log('Creating/Updating admin account...');
  
  // 1. Create or update user in auth.users
  const { data: user, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@svportal.com',
    password: '1234',
    email_confirm: true,
    user_metadata: { full_name: 'System Admin' }
  });

  let userId;
  
  if (authError) {
    if (authError.message.includes('already exists')) {
      console.log('User already exists, updating password...');
      // Get user ID
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existingUser = users.find(u => u.email === 'admin@svportal.com');
      if (existingUser) {
        userId = existingUser.id;
        await supabase.auth.admin.updateUserById(userId, { password: '1234' });
      }
    } else {
      console.error('Error creating user:', authError);
      return;
    }
  } else {
    userId = user.user.id;
  }

  // 2. Wait a moment for the trigger to insert into app_users
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Update role in app_users
  console.log('Updating role to admin for user', userId);
  const { error: dbError } = await supabase
    .from('app_users')
    .update({ role: 'admin' })
    .eq('id', userId);

  if (dbError) {
    console.error('Error updating role:', dbError);
  } else {
    console.log('Success! You can now login with email: admin@svportal.com (or username: admin) and password: 1234');
  }
}

setupAdmin();
