/**
 * routes/upload.js
 * ─────────────────
 * POST /api/upload/:moduleId
 *   → multipart/form-data, field name: "files"
 *   → accepts multiple files in one request
 *   → stores to uploads/<moduleId>/<uuid>_<originalname>
 *   → registers each file as a resource in the DB
 *
 * GET  /api/download/:moduleId/:resourceId
 *   → streams the file back to the client
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db/db');

/* ── helpers ──────────────────────────────────── */
const EXT_MAP = {
  pdf:'📄', doc:'📝', docx:'📝', ppt:'📊', pptx:'📊',
  xls:'📈', xlsx:'📈', md:'📜', txt:'📃',
  zip:'📦', rar:'📦', '7z':'📦', tar:'📦', gz:'📦',
  py:'🐍', js:'⚡', ts:'⚡', html:'🌐', css:'🎨',
  sql:'🗃️', ipynb:'📓', sh:'💻', bat:'💻', ps1:'💻',
  json:'📋', xml:'📋', csv:'📈', r:'📉',
  png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', svg:'🖼️', webp:'🖼️',
  mp4:'🎬', mkv:'🎬', avi:'🎬', mov:'🎬',
  mp3:'🎵', wav:'🎵', flac:'🎵',
  pbix:'📋', twbx:'📊',
};

function extToIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return EXT_MAP[ext] || '📎';
}
function extToType(name) {
  return (name || 'file').split('.').pop().toUpperCase();
}
function formatBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/* ── multer storage ───────────────────────────── */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', req.params.moduleId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    // preserve original name, prepend short uuid to avoid collisions
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_');
    cb(null, uuidv4().slice(0, 8) + '_' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB per file
});

/* ── POST /api/upload/:moduleId ───────────────── */
router.post('/:moduleId', upload.array('files', 500), async (req, res) => {
  const { moduleId } = req.params;
  const mod = await db.getModule(moduleId);
  if (!mod) {
    (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch(_) {} });
    return res.status(404).json({ ok: false, error: 'Module not found' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ ok: false, error: 'No files uploaded' });
  }

  const added = [];
  for (const file of req.files) {
    try {
      // 1. Read file into buffer
      const fileBuffer = fs.readFileSync(file.path);
      
      // 2. Upload to Supabase Storage (mujakaridrive bucket)
      const storagePath = `public/${moduleId}/${file.filename}`;
      const { data: uploadData, error: uploadErr } = await db.supabase.storage
        .from('mujakaridrive')
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadErr) {
        console.error('Upload Error:', uploadErr.message);
        throw uploadErr;
      }

      // 3. (No need for public URL since bucket is private, we will use signed URLs)
      
      // 4. Clean up local ephemeral file
      fs.unlinkSync(file.path);

      // 5. Save to DB
      const resource = {
        id:       uuidv4(),
        name:     file.originalname,
        type:     extToType(file.originalname),
        icon:     extToIcon(file.originalname),
        size:     formatBytes(file.size),
        bytes:    file.size,
        date:     fmtDate(new Date()),
        source:   'cloud',
        note:     null,
        filePath: storagePath, // Save the storage path for signed URLs
      };
      const saved = await db.addResource(moduleId, resource);
      added.push(saved);
    } catch (err) {
      console.error('File processing error:', err.message);
      // Clean up local file on error if it exists
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  }

  res.status(201).json({ ok: true, added: added.length, resources: added });
});

/* ── GET /api/download/:moduleId/:resourceId ───── */
router.get('/:moduleId/:resourceId', async (req, res) => {
  const { moduleId, resourceId } = req.params;
  const mod = await db.getModule(moduleId);
  if (!mod) return res.status(404).json({ ok: false, error: 'Module not found' });

  const resource = mod.resources.find(r => r.id === resourceId);
  if (!resource) return res.status(404).json({ ok: false, error: 'Resource not found' });
  if (!resource.filePath) return res.status(404).json({ ok: false, error: 'No file attached to this resource' });

  let storagePath = resource.filePath;
  
  // Backwards compatibility for old public URLs
  if (storagePath.startsWith('http')) {
    const parts = storagePath.split('mujakaridrive/');
    if (parts.length > 1) {
      storagePath = parts[1];
    }
  }

  if (storagePath.startsWith('public/')) {
    // Generate a 1-hour signed URL from the private bucket
    const { data, error } = await db.supabase.storage
      .from('mujakaridrive')
      .createSignedUrl(storagePath, 3600);

    if (error || !data) {
      console.error('Signed URL Error:', error);
      return res.status(500).json({ ok: false, error: 'Could not generate secure link' });
    }
    
    return res.redirect(data.signedUrl);
  }

  // Fallback for old local files (if testing locally)
  const fullPath = path.join(__dirname, '..', resource.filePath);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ ok: false, error: 'File missing on server' });

  if (req.baseUrl.includes('/view')) {
    res.sendFile(fullPath);
  } else {
    res.download(fullPath, resource.name);
  }
});

module.exports = router;
