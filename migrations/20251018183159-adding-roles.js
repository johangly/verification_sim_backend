"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable("Roles", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
			},
			description: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: "Descripción del rol y permisos asociados",
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
			// Campo de borrado suave (habilitado por 'paranoid: true' en el modelo)
			deletedAt: {
				type: Sequelize.DATE,
				allowNull: true, // Debe ser true para permitir valores nulos
			},
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("Roles");
	},
};
