const mongoose = require('mongoose');
const logger = require('../utils/logger');

let retries = 0;
const MAX_RETRIES = 5;

async function connectMongo() {
  try{
    const uri = process.env.MONGO_URI;

    await mongoose.connect(uri ,{
      maxPoolSize : 10,
      erverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })

    logger.info('✅ MongoDB connected');
    retries = 0;
  }catch(err){
    logger.error('Failed to connect mongoDB',err);

    if(retries < MAX_RETRIES){
      retries++;
      logger.info(`Retrying MongoDB connection (${retries}/${MAX_RETRIES})...`);

      setTimeout(connectMongo,5000*retries);
    }
    else{
      logger.error('Max attempts to connect MongoDB reached');
      process.exit(1);
    }
  }
}

module.exports = { connectMongo };
