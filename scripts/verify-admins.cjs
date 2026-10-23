const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jrvyhixqvncaoxvrefgu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UgrxSp6ByqZ405r4AW2guw_GbAqNbcD';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verify() {
  console.log('Testing Nahush (ID: nahush) login...');
  const res1 = await client.auth.signInWithPassword({
    email: 'nahush@admin.com',
    password: 'Nahush@12@#',
  });
  if (res1.error) {
    console.log('❌ Nahush failed:', res1.error.message);
  } else {
    console.log('✅ Nahush login SUCCESS! User ID:', res1.data.user.id);
  }

  console.log('Testing Anshu (ID: anshu) login...');
  const res2 = await client.auth.signInWithPassword({
    email: 'anshu@admin.com',
    password: 'Anshu@12@#',
  });
  if (res2.error) {
    console.log('❌ Anshu failed:', res2.error.message);
  } else {
    console.log('✅ Anshu login SUCCESS! User ID:', res2.data.user.id);
  }
}

verify();
