require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { seedDatabase } = require('./seedData');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  await seedDatabase({ log: console.log });

  console.log('\nSeed complete!');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
