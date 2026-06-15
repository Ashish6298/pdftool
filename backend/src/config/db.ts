import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient();

export const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully.');
  } catch (error) {
    logger.error('Failed to connect to the database:', error);
    process.exit(1);
  }
};
