const express = require('express');
const router = express.Router();
const db = require('../db/db');

// POST /api/share/:resourceId
router.post('/:resourceId', async (req, res) => {
  const { resourceId } = req.params;
  const { expiresInHours } = req.body;
  if (!expiresInHours) return res.status(400).json({ ok: false, error: 'expiresInHours required' });

  // Add x hours to current time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours, 10));

  try {
    const { data, error } = await db.supabase
      .from('shared_links')
      .insert([{ resource_id: resourceId, expires_at: expiresAt.toISOString() }])
      .select()
      .single();

    if (error) throw error;
    res.json({ ok: true, shareId: data.id });
  } catch (err) {
    console.error('Share error:', err);
    res.status(500).json({ ok: false, error: 'Failed to create share link' });
  }
});

// GET /api/share/:shareId
router.get('/:shareId', async (req, res) => {
  const { shareId } = req.params;
  try {
    // Lookup share
    const { data: share, error } = await db.supabase
      .from('shared_links')
      .select('*, resources(*)')
      .eq('id', shareId)
      .single();

    if (error || !share) return res.status(404).json({ ok: false, error: 'Share link not found' });

    // Check expiration
    const now = new Date();
    const expires = new Date(share.expires_at);
    if (now > expires) {
      return res.status(410).json({ ok: false, error: 'This shared link has expired' });
    }

    const resource = share.resources;
    if (!resource) return res.status(404).json({ ok: false, error: 'Resource deleted' });

    // Generate signed URL
    let storagePath = resource.file_path;
    if (storagePath.startsWith('http')) {
      const parts = storagePath.split('mujakaridrive/');
      if (parts.length > 1) storagePath = parts[1];
    }
    
    // Calculate seconds left for the signed URL
    const secondsLeft = Math.floor((expires.getTime() - now.getTime()) / 1000);
    const validSeconds = Math.max(60, Math.min(secondsLeft, 7 * 24 * 3600)); // between 1 min and 1 week

    if (storagePath && storagePath.startsWith('public/')) {
      const { data: urlData, error: urlErr } = await db.supabase.storage
        .from('mujakaridrive')
        .createSignedUrl(storagePath, validSeconds);
      if (urlData) {
        resource.file_path = urlData.signedUrl;
      }
    }

    res.json({ ok: true, resource: {
      id: resource.id,
      name: resource.name,
      type: resource.type,
      size: resource.size,
      icon: resource.icon,
      date: resource.date,
      fileUrl: resource.file_path,
      expiresAt: share.expires_at
    }});
  } catch (err) {
    console.error('Get share error:', err);
    res.status(500).json({ ok: false, error: 'Failed to retrieve share' });
  }
});

module.exports = router;
