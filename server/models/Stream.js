const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Stream = sequelize.define('Stream', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  channelName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    defaultValue: 'Canlı Yayına Hoş Geldiniz!',
  },
  viewerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isLive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  startTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
  }
});

module.exports = Stream;
