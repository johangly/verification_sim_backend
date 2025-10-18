export default (sequelize, DataTypes) => {
	const States = sequelize.define(
		"States",
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
		},
		{
			// Opciones del modelo
			tableName: "States", // Nombre de la tabla en la base de datos
			timestamps: true, // Habilita createdAt y updatedAt
			paranoid: true, // Deshabilita soft-delete (deletedAt)
		}
	);

	// Opcional: Define las asociaciones aquí
	States.associate = function (models) {
		States.hasMany(models.Cities, {
			foreignKey: "stateId",
			as: "cities", // Alias para incluir la relación (e.j., State.findOne({ include: 'cities' }))
		});

		States.hasMany(models.PhoneNumbers, {
			foreignKey: "stateId", // Esta es la columna en la tabla 'telefonos'
			as: "phoneNumbers",
		});
	};

	return States;
};
