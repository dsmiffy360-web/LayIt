import { createClient } from "@supabase/supabase-js";

// Reads from Vite's env — set these in .env.local for dev and in your
// host's (Vercel/Netlify) environment variables for production. Both are
// safe to expose client-side; the anon key only grants what Row Level
// Security in schema.sql allows, which is "your own rows, nothing else."
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill in your Supabase project's values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
