'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    // Desactivar temporalmente las restricciones de clave foránea
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', null);
    
    // Eliminar todos los registros de las tablas
    await queryInterface.bulkDelete('Campaigns', null, { truncate: true, cascade: true, restartIdentity: true });
    await queryInterface.bulkDelete('telefonos', null, { truncate: true, cascade: true, restartIdentity: true });
    await queryInterface.bulkDelete('Messages', null, { truncate: true, cascade: true, restartIdentity: true });
    
    // Reactivar las restricciones de clave foránea
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', null);
  },

  down: async (queryInterface, Sequelize) => {
    // No hay acción de reversión para este seed
  }
};
