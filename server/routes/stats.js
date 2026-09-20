const express = require('express');
const router = express.Router();
const { getRegisteredUsersCount, statsEvents } = require('../db');

// Standard JSON endpoint for stats
router.get('/', async (req, res) => {
  try {
    const registeredUsers = await getRegisteredUsersCount();
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.json({
      success: true,
      registeredUsers,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error fetching registered users count:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve registered users count.'
    });
  }
});

// Server-Sent Events (SSE) endpoint for real-time live count updates
router.get('/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial state immediately
  try {
    const currentCount = await getRegisteredUsersCount();
    res.write(`data: ${JSON.stringify({ registeredUsers: currentCount, timestamp: Date.now() })}\n\n`);
  } catch (err) {
    console.error('SSE initial count error:', err);
  }

  // Listener for live updates triggered by database transactions
  const onStatsUpdate = (newCount) => {
    try {
      res.write(`data: ${JSON.stringify({ registeredUsers: newCount, timestamp: Date.now() })}\n\n`);
    } catch {
      // client disconnected
    }
  };

  statsEvents.on('update', onStatsUpdate);

  // Heartbeat ping every 15 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    statsEvents.off('update', onStatsUpdate);
  });
});

module.exports = router;
