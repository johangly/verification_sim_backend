export default (sequelize, DataTypes) => {
	const PhoneNumbers = sequelize.define(
		"PhoneNumbers",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			phoneNumber: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
				validate: {
					is: {
						args: /^\+\d{1,3}\d{2,4}\d{3,4}\d{4}$/,
						msg: "El número de teléfono no tiene un formato válido.",
					},
				},
			},
			status: {
				type: DataTypes.ENUM(
					"no verificado",
					"verificado",
					"por verificar"
				),
				defaultValue: "por verificar",
				allowNull: false,
			},
			hasReceivedVerificationMessage: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			sellerId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			stateId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			createdByUserId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
		},
		{
			tableName: "telefonos",
			timestamps: true, // Esto añade createdAt y updatedAt automáticamente
		}
	);

	PhoneNumbers.associate = function (models) {
		// Relación 1:N con Messages
		PhoneNumbers.hasMany(models.Messages, {
			foreignKey: "phoneNumberId",
			as: "messages",
		});

		// Relación N:1 con Sellers
		PhoneNumbers.belongsTo(models.Sellers, {
			foreignKey: "sellerId",
			as: "seller",
		});

		// Relación N:1 con States
		PhoneNumbers.belongsTo(models.States, {
			foreignKey: "stateId",
			as: "state",
		});

		// Relación N:1 con Users (el creador)
		PhoneNumbers.belongsTo(models.Users, {
			foreignKey: "createdByUserId",
			as: "createdBy",
		});
	};

	return PhoneNumbers;
};
