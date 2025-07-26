const mongoose = require('mongoose');
const { DATABASE_CONSTANTS } = require('../constants');

class DatabaseUtils {
  static async connectDB() {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: DATABASE_CONSTANTS.MAX_POOL_SIZE,
        serverSelectionTimeoutMS: DATABASE_CONSTANTS.CONNECTION_TIMEOUT,
        retryWrites: DATABASE_CONSTANTS.RETRY_WRITES,
      });

      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error('Database connection error:', error);
      process.exit(1);
    }
  }

  static async disconnectDB() {
    try {
      await mongoose.connection.close();
      console.log('MongoDB Disconnected');
    } catch (error) {
      console.error('Database disconnection error:', error);
    }
  }

  static handleDBError(error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => val.message);
      return {
        type: 'ValidationError',
        message: 'Validation failed',
        errors
      };
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return {
        type: 'DuplicateError',
        message: `${field} already exists`,
        field
      };
    }

    if (error.name === 'CastError') {
      return {
        type: 'CastError',
        message: 'Invalid ID format',
        path: error.path
      };
    }

    return {
      type: 'DatabaseError',
      message: 'Database operation failed',
      originalError: error.message
    };
  }

  static isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  static createObjectId(id) {
    return new mongoose.Types.ObjectId(id);
  }
}

module.exports = DatabaseUtils;
