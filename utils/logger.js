import winston from 'winston';

// Configurar el logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Transporte para consola
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Transporte para archivo
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Añadir un manejo de excepciones global
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection at:', error.stack);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  logger.error('Uncaught Exception:', error.stack);
});

export default logger;
