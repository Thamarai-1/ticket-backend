/**
 * seed.js (Bridge)
 * Delegates to database/seed/seed.js
 */

const { runSeed } = require('../database/seed/seed');

if (require.main === module) {
  runSeed().catch((err) => {
    console.error(`[Seed Fatal Error]: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runSeed };
