import express from 'express';
import cors from 'cors';
import { loadConfig } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import v1 from './routes/v1.js';
import { notFound, errorHandler } from './middleware/errors.js';

const config = loadConfig();
const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestId);

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    name: '4N DEV Core API',
    status: 'online',
    version: '2.0.0',
  });
});

app.use('/v1', v1);
app.use(notFound);
app.use(errorHandler);

export { app, config };
