import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Project = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  municipality: string | null;
  zone: string | null;
  project_type: 'construction' | 'extension' | 'renovation' | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  project_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: any[] | null;
  created_at: string;
};
