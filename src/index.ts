import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for demo page
})); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files (test interface)
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ShopToPlus AI Customer Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      webhook: '/api/webhook',
      conversation: '/api/conversation/:phoneNumber',
      sendMessage: '/api/send-message',
    },
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server (only when running locally, not on Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ShopToPlus AI Customer Service Bot                      ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
║   Endpoints:                                              ║
║   - GET  /api/health                                      ║
║   - GET  /api/webhook (verification)                      ║
║   - POST /api/webhook (message handler)                   ║
║   - GET  /api/conversation/:phoneNumber                   ║
║   - POST /api/send-message                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

export default app;

