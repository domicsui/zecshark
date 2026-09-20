const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');

// GET /api/settings - Public safe settings read from Supabase (Source of Truth)
router.get('/', async (req, res) => {
  try {
    const s = await supabaseService.getSettings();

    res.json({
      success: true,
      settings: {
        projectName: s.project_name || 'ZECKSHARK',
        heroHeadline: s.hero_headline || '2222 PIXEL SHARKS',
        heroSubheadline: s.hero_subheadline || 'BUILT FOR THE ZCASH ECOSYSTEM',
        waitlistEnabled: s.isWaitlistEnabled,
        applicationsOpen: s.isApplicationsEnabled,
        applicationsEnabled: s.isApplicationsEnabled,
        walletCheckerEnabled: s.isWalletCheckerEnabled,
        xAccountUsername: s.x_account_username || 'zecshark',
        xAccountUrl: s.x_account_url || 'https://x.com/zecshark',
        announcementUrl: s.announcement_url || 'https://x.com/zecshark',
        verificationMode: s.x_verification_mode || 'DEMO'
      },
      source: s._source
    });
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve settings.' });
  }
});

module.exports = router;
