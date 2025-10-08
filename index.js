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
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app); // Crear servidor HTTP

const io = new Server(server, {
  cors: {
    origin: "*", // Ajusta esto según tus necesidades de CORS
    methods: ["GET", "POST"]
  }
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_PREFIX = process.env.API_PREFIX || '/verificationsim';

// Endpoint para enviar mensajes
app.use(`${API_PREFIX}/phonenumbers`, phoneNumbersRoutes);
app.use(`${API_PREFIX}/campaigns`, campaignsRoutes);
app.use(`${API_PREFIX}/messages`, messagesRoutes);
app.use(`${API_PREFIX}/estadisticas`, estadisticasRoutes);

// Endpoint para verificar conexión
app.get(`${API_PREFIX}/`, (req, res) => {
  res.json({ message: 'Bienvenido a la API' });
});

const processingQueue = new Map(); // Almacena las promesas de procesamiento

// Endpoint para iniciar el procesamiento
app.post(`${API_PREFIX}/sockets`, async (req, res) => {
    const { userId, phoneNumbers:datos } = req.body;
    const processingId = `proc_${Date.now()}_${userId}`;
    
    // Iniciar procesamiento en segundo plano
    processingQueue.set(processingId, {
        status: 'processing',
        progress: 0,
        result: null
    });

    // Responder inmediatamente con el ID de procesamiento
    res.json({ 
        success: true, 
        processingId,
        message: 'Procesamiento iniciado' 
    });

    // Procesamiento en segundo plano (simulado)
    try {
        const total = datos.length;
        for (let i = 0; i < total; i++) {
            // Simular procesamiento
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Actualizar progreso
            const progress = Math.round(((i + 1) / total) * 100);
            processingQueue.set(processingId, {
                status: 'processing',
                progress,
                result: null
            });
            
            // Notificar al cliente vía WebSocket
            io.to(`user_${userId}`).emit('progreso', { processingId, progress });
        }

        // Procesamiento completado
        processingQueue.set(processingId, {
            status: 'completed',
            progress: 100,
            result: { /* resultados del procesamiento */ }
        });

    } catch (error) {
        processingQueue.set(processingId, {
            status: 'error',
            progress: 0,
            error: error.message
        });
    }
});

// WebSocket para actualizaciones en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    // Unir al usuario a su sala privada
    socket.on('unir_sala', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`Usuario ${userId} unido a su sala privada`);
    });

    // Verificar estado de procesamiento
    socket.on('verificar_estado', (processingId, callback) => {
        const estado = processingQueue.get(processingId) || { status: 'not_found' };
        callback(estado);
    });
});

// Hacer que io esté disponible en las rutas
app.set('io', io);

// Start server
const PORT = process.env.PORT || 3001;
db.sequelize.authenticate().then(() => {
  db.initialize();
  server.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  logger.error('Database connection error:', err);
});

