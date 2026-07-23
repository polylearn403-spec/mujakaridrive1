const { createClient } = require('@supabase/supabase-js');
const url = 'https://wfqfglvpbqseyjgngbse.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcWZnbHZwYnFzZXlqZ25nYnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDgyODQ1MSwiZXhwIjoyMTAwNDA0NDUxfQ.mzEZ3ZZNbfUqe7lG_4ZhUuNrMDiRwR__Kugq69yHWJ4';

const supabase = createClient(url, key);

async function test() {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('List error:', listErr);
    return;
  }
  let bucket = buckets.find(b => b.name === 'mujakaridrive');
  if (!bucket) {
    const { data, error } = await supabase.storage.createBucket('mujakaridrive', { public: true });
    if (error) {
      console.error('Create error:', error);
      return;
    }
    console.log('Bucket created!');
  } else {
    console.log('Bucket already exists.');
  }
}
test();
