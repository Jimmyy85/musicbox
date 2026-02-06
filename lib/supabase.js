import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://unslwafkrxffpmtxptim.supabase.co";
const supabaseKey = "sb_publishable_gLwVmjsTVj3nTLQtVK3kfA_1rBDUH9r";

export const supabase = createClient(supabaseUrl, supabaseKey);