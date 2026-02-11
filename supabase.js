import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ceqqxyszrkbuzvlqnvfp.supabase.co'

// ✅ PEGA AQUÍ LA anon public key (empieza con eyJ...)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlcXF4eXN6cmtidXp2bHFudmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzUyNjIsImV4cCI6MjA4NDc1MTI2Mn0.xuv8LHS8HIq37IgWlj87cknnMQo2r3XBpnmTtC_Pu-U'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
