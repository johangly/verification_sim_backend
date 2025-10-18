"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("telefonos", "createdByUserId", {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "Users",
				key: "id",
			},
			onUpdate: "CASCADE",
			onDelete: "SET NULL",
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("telefonos", "createdById");
	},
};
