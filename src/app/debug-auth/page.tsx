import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function DebugAuth() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const { data: role, error: roleError } = await supabase.rpc('get_user_role');

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Auth Debug</h1>
      <pre>
{JSON.stringify({
  user: user ? { id: user.id, email: user.email } : null,
  authError,
  role,
  roleError
}, null, 2)}
      </pre>
    </div>
  );
}
