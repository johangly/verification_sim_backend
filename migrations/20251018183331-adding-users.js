"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable("Users", {
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
				comment: "Código interno o identificador de usuario",
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
			password: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: "Hash de la contraseña",
			},
			roleId: {
				type: Sequelize.INTEGER,
				allowNull: false, // Si es obligatorio que un usuario tenga rol
				references: {
					model: "Roles", // Nombre de la tabla de roles
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "RESTRICT", // Evita eliminar un rol si todavía tiene usuarios
			},
			isActive: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			lastLogin: {
				type: Sequelize.DATE,
				allowNull: true,
			},
			// Campos de Timestamps manejados por Sequelize (timestamps: true)
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
			// Nota: 'deletedAt' no se incluye porque 'paranoid: false' en el modelo.
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("Users");
	},
};
