"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("telefonos", "sellerId", {
			type: Sequelize.INTEGER,
			allowNull: false,
			references: {
				model: "Sellers",
				key: "id",
			},
			onUpdate: "CASCADE",
			onDelete: "CASCADE",
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("telefonos", "sellerId");
	},
};
