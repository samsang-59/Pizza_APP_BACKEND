const mongoose = require('mongoose');
const ServerConfig = require('./serverConfig.js');

async function connectDB() {
    try{
        await mongoose.connect(ServerConfig.DB_URL);
        console.log('successfully connected to the mongo db server.....');
    } catch(error) {
        console.log("error while connecting to the mongo db server", error);
        console.log(error);
    }
}

module.exports  = {
    connectDB
}