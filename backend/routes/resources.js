/**
 * routes/resources.js
 * ────────────────────
 * GET    /api/modules/:moduleId/resources            → list all resources
 * POST   /api/modules/:moduleId/resources            → add manual resource (JSON body)
 * DELETE /api/modules/:moduleId/resources/:resourceId → delete resource
 */

'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/db');

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
  const ext = name.split('.').pop().toLowerCase();
  return EXT_MAP[ext] || '📎';
}
function extToType(name) {
  return name.split('.').pop().toUpperCase();
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

/* ── GET /api/modules/:moduleId/resources ─────── */
router.get('/', async (req, res) => {
  const mod = await db.getModule(req.params.moduleId);
  if (!mod) return res.status(404).json({ ok: false, error: 'Module not found' });

  const { q } = req.query;
  let resources = mod.resources;
  if (q) {
    const query = q.toLowerCase();
    resources = resources.filter(r => r.name.toLowerCase().includes(query));
  }

  res.json({ ok: true, moduleId: mod.id, total: resources.length, resources });
});

/* ── POST /api/modules/:moduleId/resources ─────── */
/* Body: { name, type?, size?, note? } */
router.post('/', async (req, res) => {
  const { moduleId } = req.params;
  const mod = await db.getModule(moduleId);
  if (!mod) return res.status(404).json({ ok: false, error: 'Module not found' });

  const { name, type, size, note } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' });

  const newResource = {
    id:       uuidv4(),
    name:     name.trim(),
    type:     (type || extToType(name.trim())).toUpperCase(),
    icon:     extToIcon(name.trim()),
    size:     size || '—',
    bytes:    0,
    date:     fmtDate(new Date()),
    source:   'manual',
    note:     note || null,
    filePath: null,
  };

  const added = await db.addResource(moduleId, newResource);
  res.status(201).json({ ok: true, resource: added });
});

/* ── DELETE /api/modules/:moduleId/resources/:id ─ */
router.delete('/:resourceId', async (req, res) => {
  const { moduleId, resourceId } = req.params;

  // If the resource has an uploaded file, remove it from disk
  try {
    const mod = await db.getModule(moduleId);
    if (mod) {
      const res2 = mod.resources.find(r => r.id === resourceId);
      if (res2 && res2.filePath) {
        const full = path.join(__dirname, '..', res2.filePath);
        if (fs.existsSync(full)) fs.unlinkSync(full);
      }
    }
  } catch(_) {}

  const deleted = await db.deleteResource(moduleId, resourceId);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Resource not found' });
  res.json({ ok: true, deleted: resourceId });
});

module.exports = router;
