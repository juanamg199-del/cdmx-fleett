import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mtjxjtfbiucstgumkjnc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10anhqdGZiaXVjc3RndW1ram5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxOTA1ODgsImV4cCI6MjA5Mjc2NjU4OH0.hoihDDMQOROOSvtS7WwxdrRV23jIl_CKGGjoMnttRqs";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
