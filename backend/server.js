/**
 * server.js — MUJAKARI DRIVE  (Node.js + Express)
 * ─────────────────────────────────────────────────
 * Start:  npm start
 * Dev:    npm run dev   (requires nodemon)
 *
 * API base:  http://localhost:3000/api
 * Frontend:  http://localhost:3000
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const modulesRouter   = require('./routes/modules');
const resourcesRouter = require('./routes/resources');
const uploadRouter    = require('./routes/upload');
const searchRouter    = require('./routes/search');
const shareRouter     = require('./routes/share');

const PORT = process.env.PORT || 7070;
const app  = express();

/* ── ensure required directories exist ─────────── */
['uploads', 'data'].forEach(dir => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

/* ── middleware ─────────────────────────────────── */
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



/* Serve uploaded files as static (for previews) */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ── API routes ─────────────────────────────────── */
app.use('/api/modules',          modulesRouter);
app.use('/api/modules/:moduleId/resources', resourcesRouter);
app.use('/api/upload',           uploadRouter);
app.use('/api/download',         uploadRouter);   // download reuses upload router
app.use('/api/view',             uploadRouter);   // view reuses upload router
app.use('/api/search',           searchRouter);
app.use('/api/share',            shareRouter);

/* ── health check ───────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({
    ok:      true,
    service: 'MUJAKARI DRIVE API',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
});

/* ── root endpoint ────────────────────────────────── */
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'MUJAKARI DRIVE API is running. Frontend is hosted separately.' });
});

/* ── handle 404 for API ─────────────────────────── */
app.use('*', (req, res) => {
  res.status(404).json({ ok: false, error: 'API endpoint not found' });
});

/* ── global error handler ───────────────────────── */
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ ok: false, error: 'File too large (max 2 GB per file)' });
  }
  res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

/* ── start ──────────────────────────────────────── */
const db = require('./db/db');

db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║      MUJAKARI DRIVE  — API Server    ║');
    console.log('  ╠══════════════════════════════════════╣');
    console.log(`  ║  http://localhost:${PORT}                 ║`);
    console.log(`  ║  API: http://localhost:${PORT}/api         ║`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
});

module.exports = app;
