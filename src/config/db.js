/**
 * db.js (Compatibility Bridge)
 * Re-exports connection functions from src/config/database.js
 */

const { connectDB, disconnectDB, mongoose } = require('./database');

module.exports = {
  connectDB,
  disconnectDB,
  mongoose
};
