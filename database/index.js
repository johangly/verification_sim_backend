'use strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; 
import { Sequelize } from 'sequelize'; 
import _config from '../config/config.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);

const env = process.env.NODE_ENV || 'development';
// Accede a la configuración específica del entorno desde el objeto _config
const currentEnvConfig = _config[env];

const db = {};
let sequelize;

// Inicializa Sequelize con la configuración del entorno actual
sequelize = new Sequelize(currentEnvConfig.database, currentEnvConfig.username, currentEnvConfig.password, {
  host: currentEnvConfig.host,
  port: parseInt(currentEnvConfig.port, 10), // Asegura que el puerto sea un número entero
  dialect: 'mysql',
  timezone: '-04:00', // Zona horaria de Venezuela/Caracas (UTC-04:00)
});

// === Carga Dinámica de Modelos (Ahora usando import() asíncrono) ===
// NOTA: Todos los archivos de modelo (ej. personal.js, grupos_personal.js)
// en la carpeta 'models' deben usar 'export default (sequelize, DataTypes) => { ... };'
// en lugar de 'module.exports = (sequelize, DataTypes) => { ... };'

async function loadAndAssociateModels() {
  const modelFiles = fs
    .readdirSync(path.join(__dirname, 'models')) // Asume que los modelos están en una subcarpeta 'models'
    .filter(file => {
      return (
        file.indexOf('.') !== 0 &&
        file !== basename && // Excluye el propio index.js
        file.slice(-3) === '.js' &&
        file.indexOf('.test.js') === -1
      );
    });
    console.log("Modelos cargados:")
  for (const file of modelFiles) {
    const modelModule = await import(`./models/${file}`); // Importación dinámica asíncrona
    const modelDefinitionFunction = modelModule.default; // Accede al export default de la función del modelo
    const model = modelDefinitionFunction(sequelize, Sequelize.DataTypes); // Pasa DataTypes desde Sequelize
    db[model.name] = model;
    console.log(`|||||| ${model.name} ||||||`);
  }

  // === Definición de Asociaciones ===
  // Este bloque se ejecuta DESPUÉS de que todos los modelos han sido cargados en 'db'.
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db); // Pasa el objeto 'db' completo para que puedan definirse asociaciones
    }
  });
}

// === Objeto `db` a exportar ===
db.sequelize = sequelize; // La instancia de conexión Sequelize
db.Sequelize = Sequelize; // La clase Sequelize

// Exporta una función asíncrona para inicializar los modelos y asociaciones.
// Esto debe ser llamado una vez al inicio de tu aplicación (ej. en tu main.js de Electron o servidor Node.js).
db.initialize = async () => {
  await loadAndAssociateModels();
};

// Exporta el objeto db por defecto. Otros archivos lo importarán como:
// import db from './backend/db/index.js';
export default db;
