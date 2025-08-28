/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Messages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      phoneNumberId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'telefonos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      sentAt: {
        type: Sequelize.DATE
      },
      templateUsed: {
        type: Sequelize.STRING
      },
      responseReceived: {
        type: Sequelize.STRING
      },
      respondedAt: {
        type: Sequelize.DATE
      },
      messageStatus: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Messages');
  }
};