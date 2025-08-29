export default (sequelize, DataTypes) => {
  const Campaigns = sequelize.define('Campaigns', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sentAt: {
      type:DataTypes.DATE,
      allowNull: false
    },
    templateUsed: {
      type: DataTypes.STRING,
      allowNull: false
    },
    createdByUser: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    timestamps: true,
  });

  Campaigns.associate = function(models) {
    Campaigns.hasMany(models.Messages, {
      foreignKey: 'campaignId',
      as: 'messages'
    });
  };
  return Campaigns;
};