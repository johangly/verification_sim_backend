export default (sequelize, DataTypes) => {
    const PhoneNumbers = sequelize.define('PhoneNumbers', {
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
            args: /^\+\d{1,3}\s?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}$/,
            msg: "El número de teléfono no tiene un formato válido."
            },
        }
        },
        status: {
        type: DataTypes.ENUM('no verificado', 'verificado', 'por verificar'),
        defaultValue: 'por verificar',
        allowNull: false,
        },
    }, {
        tableName: 'telefonos',
        timestamps: true, // Esto añade createdAt y updatedAt automáticamente
    });

    return PhoneNumbers;
}