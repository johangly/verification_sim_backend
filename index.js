import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger.js';
import db from './models/index.js';
import phoneNumbersRoutes from './routes/phoneNumbers.routes.js';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_PREFIX = process.env.API_PREFIX || '/verificationsim';

// Configuración de Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// const client = twilio(accountSid, authToken);

// Endpoint para enviar mensajes
app.post(`${API_PREFIX}/send-message`, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'to y message son requeridos' });
    }

    const messageResult = await client.messages.create({
      body: message,
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${to}`
    });

    res.json({
      status: 'success',
      message: 'Mensaje enviado exitosamente',
      messageId: messageResult.sid
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      error: 'Error al enviar mensaje',
      details: error.message
    });
  }
});

// Endpoint para verificar conexión
app.use(`${API_PREFIX}/phonenumbers`, phoneNumbersRoutes);

app.get(`${API_PREFIX}/`, (req, res) => {
  res.json({ message: 'Bienvenido a la API' });
});

// Start server
const PORT = process.env.PORT || 3001;
db.syncDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  logger.error('Database connection error:', err);
});

