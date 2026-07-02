require('dotenv').config();

const connectDB = require('./config/db');
connectDB();

const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`));
