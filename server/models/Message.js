const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fromUserId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  toUserId: {
    type: DataTypes.UUID,
    allowNull: true, // Eğer genel sohbete yazılıyorsa null kalabilir
  },
  streamId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('text', 'gift'),
    defaultValue: 'text',
  },
  giftValue: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  }
});

module.exports = Message;
