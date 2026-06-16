const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

async function test() {
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@svportal.com',
    password: '1234'
  });

  if (authError) {
    console.error('Login error:', authError);
    return;
  }
  
  console.log('Logged in as:', authData.user.id);
  console.log('Testing query...');
  
  // Timeout wrapper
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
  
  const queryPromise = supabase
    .from('students')
    .select('*, student_addresses(*), student_parents(*)')
    .limit(5);

  try {
    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
    if (error) {
      console.error('Query error:', error);
    } else {
      console.log('Query success! Found rows:', data.length);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}
test();
