const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: 'https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png',
  },
  credits: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  isLive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  role: {
    type: DataTypes.ENUM('user', 'broadcaster', 'admin'),
    defaultValue: 'user',
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    defaultValue: 'other',
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1, // Harcadıkça artacak
  },
  vipStatus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  perMinuteRate: {
    type: DataTypes.INTEGER,
    defaultValue: 50, // Dakika başı özel arama ücreti
  },
  messageRate: {
    type: DataTypes.INTEGER,
    defaultValue: 10, // DM atma ücreti
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Yayıncıların admin tarafından onaylanması için
  },
  iban: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isBanned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  totalEarned: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  bio: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  commissionRate: {
    type: DataTypes.INTEGER,
    defaultValue: 80, // % yayıncıya giden oran (admin tarafından ayarlanır)
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;
