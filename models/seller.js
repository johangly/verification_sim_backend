export default (sequelize, DataTypes) => {
	const Sellers = sequelize.define(
		"Sellers",
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
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			email: {
				type: DataTypes.STRING,
				allowNull: true,
				unique: true,
				validate: {
					// Validación básica de email
					isEmail: {
						msg: "El formato del correo electrónico no es válido.",
					},
				},
			},
			isActive: {
				// Usamos BOOLEAN para un estado binario
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			// createdAt, updatedAt, deletedAt se manejan en las opciones del modelo
		},
		{
			tableName: "Sellers", // Nombre de la tabla en la base de datos
			timestamps: true, // Habilita createdAt y updatedAt
			paranoid: true, // Habilita deletedAt para Soft Delete
		}
	);

	// Definición de asociaciones (Si fueran necesarias, por ejemplo, con la tabla Product)
	Sellers.associate = function (models) {
		Sellers.hasMany(models.PhoneNumbers, {
			foreignKey: "sellerId", // Esta es la columna en la tabla 'telefonos'
			as: "phoneNumbers",
		});
	};

	return Sellers;
};
