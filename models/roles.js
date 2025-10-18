export default (sequelize, DataTypes) => {
	const Roles = sequelize.define(
		"Roles",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			description: {
				type: DataTypes.STRING,
				allowNull: true, // Asumimos que la descripción no es estrictamente obligatoria
				comment: "Descripción del rol y permisos asociados",
			},
		},
		{
			tableName: "Roles", // Nombre de la tabla
			timestamps: true, // Habilita createdAt y updatedAt
			paranoid: true, // Por defecto, no se utiliza Soft Delete
		}
	);

	// Definición de asociaciones
	Roles.associate = function (models) {
		Roles.hasMany(models.Users, {
			foreignKey: "roleId", // Usaremos 'roleId' como estándar en el código, en lugar de 'role'
			as: "users",
		});
	};

	return Roles;
};
