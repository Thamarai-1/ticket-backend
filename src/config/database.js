/**
 * database.js
 * Database Connection & Lifecycle Manager.
 * Supports Mongoose connection management and Prisma integration hooks.
 */

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

// Prevent Mongoose from hanging on operations when disconnected
mongoose.set('bufferCommands', false);

let prismaClient = null;

const getPrisma = () => {
  if (!prismaClient) {
    try {
      const { PrismaClient } = require('@prisma/client');
      prismaClient = new PrismaClient();
    } catch {
      logger.debug('Prisma client not initialized; operating with primary database adapter.');
    }
  }
  return prismaClient;
};

const connectDB = async (customUri = null) => {
  const uri = customUri || env.MONGODB_URI;
  const dbName = env.MONGODB_DB_NAME;

  const options = {
    dbName,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
  };

  try {
    const conn = await mongoose.connect(uri, options);
    logger.info(`Database connected: ${conn.connection.name} at ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Database connection closed.');
    }
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  } catch (error) {
    logger.error(`Error closing database connection: ${error.message}`);
  }
};

mongoose.connection.on('connected', () => {
  logger.debug('Mongoose connected to database cluster.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Mongoose connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from database.');
});

module.exports = {
  connectDB,
  disconnectDB,
  getPrisma,
  mongoose
};
