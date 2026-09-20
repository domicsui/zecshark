const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { checkerLimiter } = require('../middleware/rateLimit');
const supabaseService = require('../services/supabase');

// GET /api/checker/status - Public status check for checker feature toggle
router.get('/status', async (req, res) => {
  try {
    const settings = await supabaseService.getSettings();
    res.json({
      success: true,
      walletCheckerEnabled: settings.isWalletCheckerEnabled,
      source: settings._source
    });
  } catch (err) {
    console.error('Error fetching checker status:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve checker status.' });
  }
});

// POST /api/checker/check - Public rate-limited wallet eligibility check
router.post('/check', checkerLimiter, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    // 1. Verify feature toggle from Supabase (Source of Truth)
    const settings = await supabaseService.getSettings();
    if (!settings.isWalletCheckerEnabled) {
      return res.status(403).json({
        success: false,
        error: 'The Wallet Eligibility Checker is temporarily offline for maintenance.'
      });
    }

    // 2. Validate input
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid public wallet address to check.'
      });
    }

    const cleanWallet = walletAddress.trim().toLowerCase();

    // Validate format: Strictly Zcash Shielded (Sapling zs1... or Unified u1...)
    const isZcashSapling = /^zs1[a-z0-9]{75,78}$/i.test(cleanWallet);
    const isZcashUnified = /^u1[a-z0-9]{60,300}$/i.test(cleanWallet);

    if (!isZcashSapling && !isZcashUnified) {
      if (/^t[13]/i.test(cleanWallet)) {
        return res.status(400).json({
          success: false,
          error: 'Transparent address (t1...) detected. Please enter a Zcash Shielded address (Unified u1... or Sapling zs1...).'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format. Only Zcash Shielded addresses (Unified Address u1... or Sapling zs1...) are accepted.'
      });
    }

    // 3. Server-side comparison against eligible_wallets
    const checkRes = await db.execute({
      sql: 'SELECT id, notes FROM eligible_wallets WHERE LOWER(wallet_address) = ? LIMIT 1',
      args: [cleanWallet]
    });

    const isEligible = checkRes.rows.length > 0;

    // Return eligibility status without revealing entire database
    res.json({
      success: true,
      eligible: isEligible,
      walletAddress: walletAddress.trim(),
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error during wallet eligibility check:', err);
    res.status(500).json({
      success: false,
      error: 'An error occurred while verifying eligibility. Please try again.'
    });
  }
});

module.exports = router;
