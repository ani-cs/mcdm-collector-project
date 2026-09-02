import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Every request to the FastAPI backend must carry the current admin's
// Supabase access token — the backend rejects unauthenticated requests
// (see backend/main.py's get_current_user dependency). Spread this into
// a fetch() call's headers: fetch(url, { headers: await getAuthHeaders() }).
export async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}