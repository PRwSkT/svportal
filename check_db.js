require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('students').select('*').limit(5);
  if (error) {
    console.error("Error fetching students:", error);
  } else {
    console.log("Success! Fetched", data.length, "students.");
    if (data.length > 0) {
      console.log("Keys available in first student record:");
      console.log(Object.keys(data[0]));
      console.log("Sample citizen_id values:");
      data.forEach(d => console.log(`- ID: ${d.id}, Citizen ID: ${d.citizen_id}`));
    }
  }
}
check();
