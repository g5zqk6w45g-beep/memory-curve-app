import { createClient } from '@supabase/supabase-js';

// ⚠️ Remplace ci-dessous par tes VRAIES valeurs (garde les guillemets !)
const supabaseUrl = "https://xftxszzojmpsqnkhbnku.supabase.co"; 
const supabaseKey = "sb_publishable_oL7yKJF_tlhx2RTaV-oD3A_r3GwKNiE"; 

export const supabase = createClient(supabaseUrl, supabaseKey);