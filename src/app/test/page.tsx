import { createClient } from '@/lib/supabase/server';
import OfflineTestClient from './offline-client';

export default async function TestPage() {
  const supabase = await createClient();
  
  // This might fail if the user hasn't created the table or provided the keys, 
  // but it's meant to verify connection attempts.
  const { data, error } = await supabase.from('transactions').select('*').limit(1);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Verification Page</h1>
      
      <section className="mb-8 border p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Supabase Connection</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
          {error ? JSON.stringify(error, null, 2) : JSON.stringify(data, null, 2)}
        </pre>
      </section>

      <section className="mb-8 border p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Offline Queue Test</h2>
        <OfflineTestClient />
      </section>
    </div>
  );
}
