import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not configured. Database features will not work.');
  console.warn('   Set SUPABASE_URL and SUPABASE_KEY environment variables.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

// Database schema types
export interface StreamSession {
  id: string;
  user_id: string;
  connection_id: string | null;
  room_name: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'ended' | 'error';
  metadata: any;
}

export interface StreamViewer {
  id: string;
  session_id: string;
  user_id: string | null;
  joined_at: string;
  left_at: string | null;
}

export interface StreamRecording {
  id: string;
  session_id: string;
  storage_url: string;
  duration: number | null;
  file_size: number | null;
  created_at: string;
}

