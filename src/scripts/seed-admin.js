/**
 * seed-admin.js
 * Script to seed or update the primary administrator user in MongoDB.
 */

require('dotenv').config();
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const seedAdmin = async () => {
  console.log('--- Seeding Administrator User into MongoDB ---');
  await connectDB();

  const adminEmail = process.env.ADMIN_EMAIL || 'teamtitans@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'TitansAdmin2026!';
  const passwordHash = hashPassword(adminPassword);

  const adminDoc = {
    user_id: 'usr-admin-titans',
    email: adminEmail.toLowerCase().trim(),
    name: 'Team Titans Administrator',
    password_hash: passwordHash,
    role: 'admin',
    access_level: 'restricted'
  };

  const result = await User.findOneAndUpdate(
    { email: adminDoc.email },
    { $set: adminDoc },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('✅ Admin user successfully seeded:');
  console.log({
    user_id: result.user_id,
    email: result.email,
    name: result.name,
    role: result.role,
    access_level: result.access_level
  });
  console.log(`🔑 Initial Password: ${adminPassword}`);

  await disconnectDB();
  console.log('Database connection closed.');
};

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`❌ Seeding failed: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { seedAdmin };
