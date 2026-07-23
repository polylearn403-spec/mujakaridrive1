/**
 * routes/modules.js
 * ──────────────────
 * GET  /api/modules          → list all modules (id, title, color, desc, resourceCount)
 * GET  /api/modules/:id      → full module with resources
 * GET  /api/storage          → { totalBytes, formatted }
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db/db');

/* ── GET /api/modules ─────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const data = await db.getDb();
    const summary = Object.values(data.modules).map(m => ({
      id:            m.id,
      title:         m.title,
      color:         m.color,
      desc:          m.desc,
      resourceCount: m.resources.length,
    }));
    res.json({ ok: true, modules: summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── GET /api/modules/:id ─────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const mod = await db.getModule(req.params.id);
    if (!mod) return res.status(404).json({ ok: false, error: 'Module not found' });
    res.json({ ok: true, module: mod });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── GET /api/storage ─────────────────────────── */
router.get('/storage/stats', async (req, res) => {
  try {
    const bytes = await db.getTotalBytes();
    res.json({
      ok: true,
      totalBytes: bytes,
      formatted:  formatBytes(bytes),
      capacityGB: 1,
      percentUsed: parseFloat(((bytes / (1 * 1024 ** 3)) * 100).toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function formatBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}

module.exports = router;
