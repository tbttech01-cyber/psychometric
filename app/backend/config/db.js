const mongoose = require('mongoose');

const connectDB = async (retries = 3) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    if (retries > 0) {
      const delay = (4 - retries) * 2000;
      console.log(`DB connection failed. Retrying in ${delay / 1000}s... (${retries} left)`);
      setTimeout(() => connectDB(retries - 1), delay);
    } else {
      console.error('MongoDB connection failed after 3 retries:', err.message);
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

module.exports = connectDB;
