import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://hcngacohwiwphcbroint.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjbmdhY29od2l3cGhjYnJvaW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDc1MjUsImV4cCI6MjA5MDQ4MzUyNX0.Rv9OlD7pltClHO2JyoEk5q7htUfUWc__StgxOQK4uaM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'studyplan-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
