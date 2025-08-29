import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger.js';
import db from './database/index.js';
import phoneNumbersRoutes from './routes/phoneNumbers.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import campaignsRoutes from './routes/campaigns.routes.js';
import estadisticasRoutes from './routes/estadisticas.routes.js';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const API_PREFIX = process.env.API_PREFIX || '/verificationsim';

// Endpoint para enviar mensajes
app.use(`${API_PREFIX}/phonenumbers`, phoneNumbersRoutes);
app.use(`${API_PREFIX}/messages`, messagesRoutes);
app.use(`${API_PREFIX}/campaigns`, campaignsRoutes);
app.use(`${API_PREFIX}/estadisticas`, estadisticasRoutes);

app.use(express.json());

// Endpoint para verificar conexión
app.get(`${API_PREFIX}/`, (req, res) => {
  res.json({ message: 'Bienvenido a la API' });
});

// Start server
const PORT = process.env.PORT || 3001;
db.sequelize.authenticate().then(() => {
  db.initialize();
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  logger.error('Database connection error:', err);
});

