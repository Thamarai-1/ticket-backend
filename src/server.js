/**
 * server.js
 * HTTP Server Entry Point.
 */

const env = require('./config/env');
const app = require('./config/app');
const { connectDB } = require('./config/database');
const logger = require('./config/logger');

const PORT = env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      logger.info(`Primary backend listening on http://localhost:${PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health check available at http://localhost:${PORT}/api/health`);
    });
    return server;
  } catch (error) {
    logger.error(`Fatal failure starting service: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
