const fs = require('fs');
const path = require('path');

const files = [
  'src/app/admin/website/personnel/page.tsx',
  'src/app/admin/website/news/page.tsx',
  'src/app/admin/website/albums/page.tsx',
  'src/app/admin/website/albums/[id]/page.tsx',
  'src/app/admin/website/calendar/page.tsx',
  'src/app/admin/website/documents/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Add import if not present
  if (!content.includes('../actions')) {
    content = content.replace("import { createClient } from '@/lib/supabase/client';", "import { createClient } from '@/lib/supabase/client';\nimport { insertRecord, updateRecord, deleteRecord } from '../actions';");
    content = content.replace("import { insertRecord, updateRecord, deleteRecord } from '../actions';", "import { insertRecord, updateRecord, deleteRecord } from '@/app/admin/website/actions';"); // Fixed path to be absolute
  }

  // Replace delete
  content = content.replace(/const \{ error \} = await supabase\.from\('([^']+)'\)\.delete\(\)\.eq\('id', (photoId|id)\);/g, "await deleteRecord('$1', $2);");
  
  // Replace insert
  content = content.replace(/const \{ error \} = await supabase\.from\('([^']+)'\)\.insert\(\[payload\]\);/g, "await insertRecord('$1', payload);");
  
  // Replace update
  content = content.replace(/const \{ error \} = await supabase\.from\('([^']+)'\)\.update\((payload|\{ is_active: !currentStatus \}|\{ is_published: !currentStatus, published_at: [^}]+\})\)\.eq\('id', (editingId|id)\);/g, (match, table, payloadStr, idVar) => {
    if (payloadStr === '{ is_active: !currentStatus }' || payloadStr.includes('is_published')) {
      return `await updateRecord('${table}', ${idVar}, ${payloadStr});`;
    }
    return `await updateRecord('${table}', ${idVar}, ${payloadStr});`;
  });
  
  // Remove if (error) throw error;
  content = content.replace(/if \(error\) throw error;/g, "");

  fs.writeFileSync(file, content, 'utf-8');
  console.log('Refactored', file);
}
