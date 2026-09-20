const app = require('../server/index');
const { initDB } = require('../server/db');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    try {
      await initDB();
      initialized = true;
    } catch (err) {
      console.error('Vercel serverless initDB error:', err);
    }
  }
  return app(req, res);
};
