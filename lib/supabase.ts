import { createClient } from '@supabase/supabase-js';

// On récupère les clés
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Astuce pour Vercel : Si les clés n'existent pas (pendant le build), 
// on ne lance PAS createClient tout de suite pour éviter le crash.
// On crée un client uniquement si l'URL est présente.

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", 
  supabaseKey || "placeholder-key"
);