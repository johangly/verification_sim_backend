"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("telefonos", "stateId", {
			type: Sequelize.INTEGER,
			allowNull: false,
			references: {
				model: "States",
				key: "id",
			},
			onUpdate: "CASCADE",
			onDelete: "RESTRICT",
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("telefonos", "stateId");
	},
};
