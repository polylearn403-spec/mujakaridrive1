require('dotenv').config();
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function migrate() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  const dbUrl = 'postgresql://postgres:joshuamujakari6945@db.wfqfglvpbqseyjgngbse.supabase.co:5432/postgres';

  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // 1. Create shared_links table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_id TEXT REFERENCES resources(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Created shared_links table');

    // 2. Insert new modules (ignore duplicates if run multiple times)
    await client.query(`
      INSERT INTO modules (id, title, color, "desc") VALUES 
      ('net', 'Network', '#3b82f6', 'Network topologies, protocols, routing, and switching.'),
      ('sw', 'Software', '#ec4899', 'Software engineering, design patterns, and testing.'),
      ('hw', 'Hardware', '#64748b', 'Computer architecture, microprocessors, and digital logic.'),
      ('oop', 'OOP', '#06b6d4', 'Object-oriented programming concepts and practices.'),
      ('db', 'Database', '#14b8a6', 'Database design, SQL, normalization, and NoSQL.')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Inserted new modules');

    // 3. Make bucket private
    const supabase = createClient(url, key);
    const { error } = await supabase.storage.updateBucket('mujakaridrive', {
      public: false
    });
    if (error) {
      console.error('Error making bucket private:', error.message);
    } else {
      console.log('Bucket mujakaridrive is now PRIVATE.');
    }

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await client.end();
  }
}

migrate();
