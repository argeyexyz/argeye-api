import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = process.env.ARGEYE_MODEL || 'claude-haiku-4-5-20251001';

let _supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  _supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: { persistSession: false },
      realtime: { transport: ws },
    }
  );
}
export const supabase = _supabase;
