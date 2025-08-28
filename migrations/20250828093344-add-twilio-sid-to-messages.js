/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Messages', 'twilioSid', {
      type: Sequelize.STRING,
      allowNull: true  // Ajusta según necesites
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Messages', 'twilioSid');
  }
};
