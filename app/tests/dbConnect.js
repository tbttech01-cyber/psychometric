const mongoose = require('mongoose');

async function connect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
