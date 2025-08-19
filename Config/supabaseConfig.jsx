import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// Use environment variables for Supabase configuration
const supabaseUrl = "https://aqhzvbskqbdcelpziswu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxaHp2YnNrcWJkY2VscHppc3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMTQzNDAsImV4cCI6MjA2MTc5MDM0MH0.hC7jTi7sWUEgP-kI3MgcYjSbVOiFxp-yZOZL16KCSy4";

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

export default supabase;





