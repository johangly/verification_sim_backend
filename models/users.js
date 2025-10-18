export default (sequelize, DataTypes) => {
	const Users = sequelize.define(
		"Users",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			code: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
				comment: "Código interno o identificador de usuario", // Usa 'comment' para notas
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			email: {
				type: DataTypes.STRING,
				allowNull: true, // Se asume allowNull: true si solo tiene 'unique'
				unique: true,
				validate: {
					isEmail: {
						msg: "El formato del correo electrónico no es válido.",
					},
				},
			},
			password: {
				type: DataTypes.STRING,
				allowNull: false,
				comment: "Hash de la contraseña",
			},
			roleId: {
				type: DataTypes.INTEGER,
				allowNull: false, // Asumiendo que el rol es obligatorio
			},
			isActive: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			lastLogin: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			// createdAt y updatedAt son manejados por 'timestamps: true'
		},
		{
			tableName: "Users",
			timestamps: true, // Habilita createdAt y updatedAt
			paranoid: true, // No se especificó soft-delete, por lo tanto 'deletedAt' no se usa
		}
	);

	Users.associate = function (models) {
		Users.belongsTo(models.Roles, {
			foreignKey: "roleId",
			as: "role",
		});

		Users.hasMany(models.PhoneNumbers, {
			foreignKey: "createdByUserId", // Esta es la columna en la tabla 'telefonos'
			as: "phoneNumbersCreated", // Alias para diferenciarlo de otras relaciones de usuario
		});
	};

	return Users;
};
