'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db/db');

/* ── GET /api/search?q=... ────────────────────── */
router.get('/', async (req, res) => {
  const query = req.query.q || '';
  try {
    const results = await db.searchResources(query);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
