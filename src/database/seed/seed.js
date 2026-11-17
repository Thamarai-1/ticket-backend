/**
 * seed.js
 * Database Seeding Script for Phase 1 Historical IT Tickets.
 * Reads validated dataset from sample-tickets.json and performs idempotent upserts.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../../config/database');
const { Ticket, ticketRepository } = require('../../repositories/ticket.repository');
const { auditRepository } = require('../../repositories/audit.repository');
const logger = require('../../config/logger');

const runSeed = async () => {
  console.log('=====================================================');
  console.log('   IT Ticket Assistant - Historical Database Seeder   ');
  console.log('=====================================================');

  const datasetPath = path.resolve(__dirname, 'sample-tickets.json');

  if (!fs.existsSync(datasetPath)) {
    console.error(`[Seed Error] Dataset file not found at: ${datasetPath}`);
    process.exit(1);
  }

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  } catch (err) {
    console.error(`[Seed Error] Failed to parse JSON dataset: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Seed] Loaded ${rawData.length} records from dataset.`);

  await connectDB();

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const rejected = [];

  const bulkOps = [];

  for (const record of rawData) {
    try {
      const doc = new Ticket(record);
      const validationErr = doc.validateSync();

      if (validationErr) {
        rejected.push({
          ticket_id: record.ticket_id || 'UNKNOWN',
          errors: Object.values(validationErr.errors).map((e) => e.message)
        });
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: {
            ticket_id: record.ticket_id,
            source_type: { $ne: 'production' }
          },
          update: {
            $set: {
              ...record,
              created_at: new Date(record.created_at),
              resolved_at: record.resolved_at ? new Date(record.resolved_at) : null
            }
          },
          upsert: true
        }
      });
    } catch (err) {
      rejected.push({
        ticket_id: record.ticket_id,
        errors: [err.message]
      });
    }
  }

  if (bulkOps.length > 0) {
    console.log(`[Seed] Executing bulk write for ${bulkOps.length} valid tickets...`);
    const bulkResult = await ticketRepository.bulkWrite(bulkOps, { ordered: false });

    insertedCount = bulkResult.upsertedCount || 0;
    updatedCount = bulkResult.modifiedCount || 0;
    skippedCount = bulkOps.length - (insertedCount + updatedCount);

    console.log(`[Seed] BulkWrite Result:`);
    console.log(`   - Newly Inserted: ${insertedCount}`);
    console.log(`   - Updated/Refreshed: ${updatedCount}`);
    console.log(`   - Matched/Unchanged: ${skippedCount}`);
    console.log(`   - Rejected Invalid: ${rejected.length}`);
  }

  // Record Audit Event
  await auditRepository.create({
    event_id: `EVT-SEED-${Date.now()}`,
    correlation_id: `CORR-SEED-${Date.now()}`,
    event_type: 'SEED_INGESTED',
    ticket_id: 'SYSTEM_BULK_SEED',
    actor_reference: {
      actor_id: 'seed_script',
      actor_type: 'seeder'
    },
    metadata: {
      dataset_file: path.basename(datasetPath),
      total_processed: rawData.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      rejected: rejected.length
    }
  });

  console.log('[Seed] Audit event EVT-SEED logged successfully.');

  const totalInDb = await Ticket.countDocuments();
  console.log(`[Seed] Total tickets currently in database: ${totalInDb}`);

  await disconnectDB();
  console.log('[Seed] Seeding process completed successfully.');
};

if (require.main === module) {
  runSeed().catch((err) => {
    console.error(`[Seed Fatal Error]: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runSeed };
