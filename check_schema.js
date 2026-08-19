const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({ title_th: 'Test', event_type: 'academic', start_date: '2026-08-18' })
    .select('*');
  console.log('calendar_events:', data ? data[0] : error);
  if (data) await supabase.from('calendar_events').delete().eq('id', data[0].id);

  const res2 = await supabase
    .from('documents')
    .insert({ title_th: 'Test', document_type: 'form', file_url: 'http' })
    .select('*');
  console.log('documents:', res2.data ? res2.data[0] : res2.error);
  if (res2.data) await supabase.from('documents').delete().eq('id', res2.data[0].id);
}
run();
