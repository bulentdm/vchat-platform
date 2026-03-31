const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  callerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  durationMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalPricePaid: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('ongoing', 'completed', 'missed', 'rejected'),
    defaultValue: 'ongoing'
  }
});

module.exports = Call;
