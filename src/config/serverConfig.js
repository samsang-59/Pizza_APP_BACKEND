const dotenv = require('dotenv');

dotenv.config(); // load environment variables from .env file

module.exports = {
    PORT: process.env.PORT,
    DB_URL: process.env.DB_URL
}