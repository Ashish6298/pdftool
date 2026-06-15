import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db';
import projectRoutes from './routes/projectRoutes';
import { errorHandler } from './middleware/errorMiddleware';
import { logger } from './utils/logger';

// Load env variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow local testing and sharing images/PDFs
}));
app.use(cors({
  origin: '*', // Allow connections from Vite dev server
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving (if any)
const storageDir = process.env.STORAGE_DIR || path.join(__dirname, '../../storage');
app.use('/static/uploads', express.static(path.join(storageDir, 'uploads')));
app.use('/static/exports', express.static(path.join(storageDir, 'exports')));

// API routes
app.use('/api/projects', projectRoutes);

// Catch-all route handler
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date() });
});

// Centralized error handler
app.use(errorHandler);

// Connect to Database and start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
});
