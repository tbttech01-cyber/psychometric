require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });
const mongoose = require('mongoose');

module.exports = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};
