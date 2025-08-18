import { Sequelize, DataTypes } from 'sequelize';
import connection from '../database/connection.js';

import PhoneNumbers from './PhoneNumbers.js';

// Objeto para almacenar los modelos y la instancia de Sequelize
const db = {
  sequelize: connection,
  Sequelize: Sequelize,
  PhoneNumbers: PhoneNumbers(connection, DataTypes),
}; 

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

async function syncDatabase(sync=false) {
  try {
    await db.sequelize.authenticate();
    console.log('Conexión a la base de datos establecida correctamente.');
    if (sync) {
      await db.sequelize.sync({ alter: true }); // Sincroniza los modelos con la DB
      console.log('Modelos sincronizados con la base de datos.');
    }
  } catch (error) {
    console.error('No se pudo conectar o sincronizar la base de datos:', error);
  }
} 

db.syncDatabase = syncDatabase;

export default db;