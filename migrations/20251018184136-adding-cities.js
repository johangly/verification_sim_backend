"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable("Cities", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			stateId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "States",
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "CASCADE",
			},
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
		await queryInterface.dropTable("Cities");
	},
};
