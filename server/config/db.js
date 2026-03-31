const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'vchat_db',
  process.env.DB_USER || process.env.MYSQLUSER || 'root',
  process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'db',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    dialect: 'mysql',
    logging: false
  }
);

module.exports = sequelize;
