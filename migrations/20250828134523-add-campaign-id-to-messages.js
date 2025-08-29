/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Messages', 'campaignId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Campaigns',
        key: 'id',
      },
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Messages', 'campaignId');
  },
};