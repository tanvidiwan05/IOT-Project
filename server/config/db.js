/**
 * MongoDB Connection Configuration
 * Handles database connection with retry logic and event listeners
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medicinebox';
  
  try {
    const conn = await mongoose.connect(uri, {
      // Mongoose 8 uses these defaults, but being explicit for clarity
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting reconnection...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    console.log('⏳ Retrying connection in 5 seconds...');
    
    // Retry connection after 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    return connectDB();
  }
};

module.exports = connectDB;
