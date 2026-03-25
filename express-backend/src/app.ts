import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { patientsRouter } from './routes/patients';
import { riskRouter } from './routes/risk';
import { doctorsRouter } from './routes/doctors';
import { appointmentsRouter } from './routes/appointments';
import { reportsRouter } from './routes/reports';
import { medicationsRouter } from './routes/medications';
import { chatbotRouter } from './routes/chatbot';
import { compatibilityRouter } from './routes/compatibility';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        // allow non-browser or same-origin requests
        callback(null, true);
        return;
      }
      if (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: false,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'),
);

// Public health check
app.use('/', healthRouter);

// Versioned API prefix (aligns with existing FastAPI /api/v1)
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/mongo/patients', patientsRouter);
app.use('/api/v1/mongo/doctors', doctorsRouter);
app.use('/api/v1/mongo/appointments', appointmentsRouter);
app.use('/api/v1/mongo/reports', reportsRouter);
app.use('/api/v1/mongo/medications', medicationsRouter);
app.use('/api/v1/compatibility', compatibilityRouter);
app.use('/api/v1/risk', riskRouter);
app.use('/api/v1/chatbot', chatbotRouter);

// Error handler (keep last)
app.use(errorHandler);

export { app };

