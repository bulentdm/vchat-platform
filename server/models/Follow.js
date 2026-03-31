const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  followerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  followingId: {
    type: DataTypes.UUID,
    allowNull: false
  }
});

module.exports = Follow;
