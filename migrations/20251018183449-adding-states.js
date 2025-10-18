"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable("States", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			code: {
				type: Sequelize.STRING,
				allowNull: true,
				unique: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			// Campos de timestamp (habilitados por 'timestamps: true' en el modelo)
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
			},
			deletedAt: {
				type: Sequelize.DATE,
				allowNull: true,
			},
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("States");
	},
};
