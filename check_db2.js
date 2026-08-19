const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getCols(table) {
  const { data, error } = await supabase.rpc('get_columns', { table_name: table });
  // If rpc doesn't exist, we can use a raw postgrest query? No, just try an insert that fails to get column names, or use the openapi.json.
}

async function run() {
  const fs = require('fs');
  const openapi = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));
  console.log('calendar_events properties:', Object.keys(openapi.definitions.calendar_events.properties));
  console.log('documents properties:', Object.keys(openapi.definitions.documents.properties));
}
run();
