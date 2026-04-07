import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewlufiwgnnnfwdjoafcu.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHVmaXdnbm5uZndkam9hZmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTI3MTMsImV4cCI6MjA5MDQ4ODcxM30.C8XNhInLONhDYtt0twygGFg0M4sufZI3oyCTeFjoP-Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
export { SUPABASE_URL, SUPABASE_ANON };
