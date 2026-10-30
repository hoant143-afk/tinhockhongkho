import express from 'express';
import { createServer as createViteServer } from 'vite';
import { chatHandler } from './src/api/chat';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' })); // Match the zip's 1MB limit check

  // API Routes
  app.post('/api/chat', chatHandler);

  // Vite Middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

startServer();
