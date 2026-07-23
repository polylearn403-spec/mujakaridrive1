'use strict';

const { createClient } = require('@supabase/supabase-js');

let supabase;

/* ── Database Initialization ──────────────────── */
async function initDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.error('❌ SUPABASE_URL or SUPABASE_KEY is missing in .env');
    process.exit(1);
  }

  supabase = createClient(url, key);
  
  // Verify connection by checking if modules exist
  const { data, error } = await supabase.from('modules').select('id').limit(1);
  if (error) {
    console.error('❌ Supabase Connection Error:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Connected to Supabase');
}

/* ── public API ──────────────────────────────── */
module.exports = {
  get supabase() { return supabase; },
  initDb,

  /** Return the full DB object equivalent */
  async getDb() {
    const { data: modules, error: modErr } = await supabase.from('modules').select('*');
    if (modErr) throw modErr;

    const { data: resources, error: resErr } = await supabase.from('resources').select('*');
    if (resErr) throw resErr;

    const result = { modules: {}, meta: { seeded: true } };
    
    for (const mod of modules) {
      // Supabase returns camelCase if we defined it that way, but we used snake_case in SQL
      // We need to map snake_case to camelCase for the frontend
      const mappedResources = resources
        .filter(r => r.module_id === mod.id)
        .map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          size: r.size,
          bytes: parseInt(r.bytes, 10),
          date: r.date,
          icon: r.icon,
          source: r.source,
          filePath: r.file_path,
          createdAt: r.created_at
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      result.modules[mod.id] = {
        id: mod.id,
        title: mod.title,
        color: mod.color,
        desc: mod.desc,
        resources: mappedResources
      };
    }
    return result;
  },

  /** Get a single module by id */
  async getModule(moduleId) {
    const { data: mod, error: modErr } = await supabase
      .from('modules')
      .select('*')
      .eq('id', moduleId)
      .single();

    if (modErr || !mod) return null;
    
    const { data: resources, error: resErr } = await supabase
      .from('resources')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false });

    if (resErr) throw resErr;

    const mappedResources = resources.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      size: r.size,
      bytes: parseInt(r.bytes, 10),
      date: r.date,
      icon: r.icon,
      source: r.source,
      filePath: r.file_path,
      createdAt: r.created_at
    }));

    return {
      id: mod.id,
      title: mod.title,
      color: mod.color,
      desc: mod.desc,
      resources: mappedResources
    };
  },

  /** Add a resource to a module */
  async addResource(moduleId, resourceData) {
    // Map camelCase to snake_case for DB insertion
    const dbResource = {
      id: resourceData.id,
      module_id: moduleId,
      name: resourceData.name,
      type: resourceData.type,
      size: resourceData.size,
      bytes: resourceData.bytes,
      date: resourceData.date,
      icon: resourceData.icon,
      source: resourceData.source,
      file_path: resourceData.filePath
    };

    const { data, error } = await supabase
      .from('resources')
      .insert([dbResource])
      .select()
      .single();

    if (error) throw error;
    
    return resourceData; // Return the camelCase version we passed in
  },

  /** Delete a resource from a module */
  async deleteResource(moduleId, resourceId) {
    const { error } = await supabase
      .from('resources')
      .delete()
      .match({ id: resourceId, module_id: moduleId });

    if (error) return false;
    return true;
  },

  /** Get total byte count across all real-file resources */
  async getTotalBytes() {
    const { data, error } = await supabase
      .from('resources')
      .select('bytes');
      
    if (error || !data) return 0;
    
    return data.reduce((sum, row) => sum + parseInt(row.bytes || 0, 10), 0);
  },

  /** Global search across all modules */
  async searchResources(query) {
    if (!query) return [];
    const { data, error } = await supabase
      .from('resources')
      .select(`
        *,
        modules ( title, color )
      `)
      .ilike('name', `%${query}%`)
      .limit(30);

    if (error) return [];
    
    return data.map(r => ({
      id: r.id,
      moduleId: r.module_id,
      moduleTitle: r.modules ? r.modules.title : 'Unknown Module',
      moduleColor: r.modules ? r.modules.color : '#fff',
      name: r.name,
      type: r.type,
      size: r.size,
      icon: r.icon
    }));
  }
};
