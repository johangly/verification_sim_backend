export default (sequelize, DataTypes) => {
  const Messages = sequelize.define('Messages', {
      phoneNumberId: {
          type: DataTypes.INTEGER,
      },
      sentAt: {
          type: DataTypes.DATE,
      },
      templateUsed: {
          type: DataTypes.STRING,
      },
      responseReceived: {
          type: DataTypes.STRING,
      },
      respondedAt: {
          type: DataTypes.DATE,
      },
      messageStatus: {
          type: DataTypes.STRING,
      },
      twilioSid: {  // Nuevo campo
        type: DataTypes.STRING,
        allowNull: true  // Ajusta según tus necesidades
      },
      campaignId: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
  }, {
      timestamps: true,
  });

  Messages.associate = function(models) {
      Messages.belongsTo(models.PhoneNumbers, {
          foreignKey: 'phoneNumberId',
          as: 'phoneNumber'
      });
      Messages.belongsTo(models.Campaigns, {
        foreignKey: 'campaignId',
        as: 'campaign'
    });
  };

  return Messages;
};