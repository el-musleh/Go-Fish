import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://moiajtcnyimeqllextxn.supabase.co';
const supabaseKey = 'sb_publishable_4XUEzFKVrfB62393Jc_aNw_868A81Tx';

export const supabase = createClient(supabaseUrl, supabaseKey);
