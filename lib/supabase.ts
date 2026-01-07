import { createClient } from '@supabase/supabase-js';

// Si les clés ne sont pas encore chargées (pendant le build), on met des fausses valeurs pour éviter le crash.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseKey);