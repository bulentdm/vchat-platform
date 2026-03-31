const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('purchase', 'gift_sent', 'gift_received', 'call_payment', 'withdrawal', 'withdrawal_request'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER, // elmas miktarı
    allowNull: false,
  },
  priceInTL: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  packageId: {
    type: DataTypes.INTEGER,
    allowNull: true, // sadece purchase için
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending',
  },
  paymentMethod: {
    type: DataTypes.STRING, // 'mock', 'iyzico', 'paytr', 'crypto'
    defaultValue: 'mock',
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'Transactions',
  timestamps: true,
});

module.exports = Transaction;
