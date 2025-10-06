import {createLogger, format, transports } from 'winston';

// Configurar el logger
// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()
//   ),
//   transports: [
//     // Transporte para consola
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.simple()
//       )
//     }),
//     // Transporte para archivo
//     new winston.transports.File({
//       filename: 'error.log',
//       level: 'error'
//     }),
//     new winston.transports.File({ filename: 'combined.log' })
//   ]
// });

const logger = createLogger({
  format: format.combine(
    format.simple(),
    format.timestamp({
      format: () => new Date().toLocaleString('es-VE', { 
        timeZone: 'America/Caracas',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }),
    format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.File({
      maxsize:5120000,
      maxFiles:5,
      filename:'combined.log',
    }),
    new transports.Console({
      level:'debug',
    })
  ]
   
});

// Añadir un manejo de excepciones global
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection at:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

export default logger;
