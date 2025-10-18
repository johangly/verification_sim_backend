export default (sequelize, DataTypes) => {
	const Cities = sequelize.define(
		"Cities",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			stateId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
		},
		{
			// Opciones del modelo
			tableName: "Cities",
			timestamps: true,
			paranoid: true,
		}
	);

	Cities.associate = function (models) {
		// Define la relación BelongsTo (muchas ciudades pertenecen a un estado)
		Cities.belongsTo(models.States, {
			foreignKey: "stateId",
			as: "state",
		});
	};

	return Cities;
};
