/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('telefonos', 'hasReceivedVerificationMessage', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('telefonos', 'hasReceivedVerificationMessage');
  }
}
