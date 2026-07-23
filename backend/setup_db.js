const { Client } = require('pg');

const connectionString = 'postgresql://postgres:joshuamujakari6945@db.wfqfglvpbqseyjgngbse.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function setup() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    const createTables = `
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        color TEXT NOT NULL,
        "desc" TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        module_id TEXT REFERENCES modules(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size TEXT NOT NULL,
        bytes BIGINT NOT NULL,
        date TEXT NOT NULL,
        icon TEXT NOT NULL,
        source TEXT DEFAULT 'uploaded',
        file_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await client.query(createTables);
    console.log('Tables created successfully.');

    // Check if modules already exist
    const { rows } = await client.query('SELECT count(*) FROM modules');
    if (parseInt(rows[0].count) === 0) {
      const insertModules = `
        INSERT INTO modules (id, title, color, "desc") VALUES 
        ('da', 'Data Analytics', '#00f0ff', 'Statistical analysis, visualization tools, and data processing resources for your DA coursework.'),
        ('web', 'Web Development', '#a855f7', 'Frontend frameworks, backend APIs, and full-stack project resources.'),
        ('sec', 'Information Security', '#ef4444', 'Cybersecurity protocols, encryption standards, and threat analysis resources.'),
        ('research', 'Research Methods', '#22c55e', 'Academic writing, methodology frameworks, and literature review tools.'),
        ('os', 'Operating Systems', '#f59e0b', 'OS architecture, process management, and system administration resources.');
      `;
      await client.query(insertModules);
      console.log('Default modules inserted successfully.');
    } else {
      console.log('Modules already seeded.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

setup();
