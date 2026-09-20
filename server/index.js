require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets from public/
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API Routes
app.use('/api/stats', require('./routes/stats'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/checker', require('./routes/checker'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/settings', require('./routes/settings'));

// Serve built frontend if in production or dist exists
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback for SPA routes (e.g. /waitlist, /checker, /admin, /roadmap, /faq)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/assets')) {
    return next();
  }
  const indexHtml = path.join(distPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      // In development when dist isn't built yet, respond with API health status
      res.json({
        message: 'ZECKSHARK API Server Running',
        version: '1.0.0',
        frontendNotice: 'Frontend build not found in dist/. Please run `npm run build` or start Vite dev server.'
      });
    }
  });
});

// Initialize database and start listening (when not in serverless)
if (!process.env.VERCEL) {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🦈 ZECKSHARK Backend Engine Ready`);
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`=========================================`);
    });
  }).catch(err => {
    console.error('Fatal Database Initialization Error:', err);
    process.exit(1);
  });
}

module.exports = app;
