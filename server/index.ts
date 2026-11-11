import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import apiRouter from './routes/index.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { initDatabase, checkConnection } from './db.ts';

// Load environment variables
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
const rootEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Proper CORS Configuration for Vite frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for local development
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// API Routes
app.use('/api', apiRouter);

// Root route
app.get('/', (_req, res) => {
  res.json({
    name: 'Healthcare RCM Backend API',
    status: 'running',
    healthCheck: '/api/health',
    version: '1.0.0',
  });
});

// 404 Handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API route '${req.originalUrl}' not found.`,
  });
});

// Centralized error handler
app.use(errorHandler);

// Initialize DB and start server
async function startServer() {
  console.log('====================================================');
  console.log('🏥 Starting Healthcare RCM Express + PostgreSQL Backend');
  console.log('====================================================');

  const dbReady = await initDatabase();
  const dbStatus = await checkConnection();

  if (dbReady) {
    console.log(`✅ [Database] PostgreSQL connected and initialized on database '${dbStatus.database}'`);
    try {
      const { getPostgresCheckpointer } = await import('./ai/memory.ts');
      await getPostgresCheckpointer();
    } catch (memErr: any) {
      console.warn(`[Memory Checkpointer] Initialization notice: ${memErr?.message}`);
    }
  } else {
    console.warn(`⚠️ [Database] PostgreSQL warning: ${dbStatus.error || 'Check DATABASE_URL in .env'}`);
  }

  app.listen(port, () => {
    console.log(`🚀 [Server] Express backend listening on http://localhost:${port}`);
    console.log(`🩺 [Health] Health check endpoint: http://localhost:${port}/api/health`);
    console.log('====================================================');
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export default app;
