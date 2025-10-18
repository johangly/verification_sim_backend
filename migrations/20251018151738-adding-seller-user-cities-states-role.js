/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable("Sellers", {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			code: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			email: {
				type: Sequelize.STRING,
				allowNull: true,
				unique: true,
			},
			isActive: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			// Campos de Timestamps
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			// Campo requerido por 'paranoid: true' para Soft Delete
			deletedAt: {
				allowNull: true,
				type: Sequelize.DATE,
			},
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("Sellers");
	},
};
