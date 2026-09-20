const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/settings - Public safe settings
router.get('/', async (req, res) => {
  try {
    const resSettings = await db.execute(`
      SELECT key, value FROM settings 
      WHERE key IN (
        'project_name', 
        'hero_headline', 
        'hero_subheadline', 
        'waitlist_enabled', 
        'applications_open', 
        'wallet_checker_enabled', 
        'x_account_username', 
        'x_account_url', 
        'announcement_url',
        'x_verification_mode'
      )
    `);

    const settings = {};
    for (const r of resSettings.rows) {
      settings[r.key] = r.value;
    }

    res.json({
      success: true,
      settings: {
        projectName: settings.project_name || 'ZECKSHARK',
        heroHeadline: settings.hero_headline || '2222 PIXEL SHARKS',
        heroSubheadline: settings.hero_subheadline || 'BUILT FOR THE ZCASH ECOSYSTEM',
        waitlistEnabled: settings.waitlist_enabled !== 'false',
        applicationsOpen: settings.applications_open !== 'false',
        walletCheckerEnabled: settings.wallet_checker_enabled !== 'false',
        xAccountUsername: settings.x_account_username || 'zecshark',
        xAccountUrl: settings.x_account_url || 'https://x.com/zecshark',
        announcementUrl: settings.announcement_url || 'https://x.com/zecshark',
        verificationMode: settings.x_verification_mode || 'DEMO'
      }
    });
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve settings.' });
  }
});

module.exports = router;
