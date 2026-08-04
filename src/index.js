const express = require('express');
const ServerConfig = require('./config/serverConfig.js');
const { connectDB } = require('./config/dbConfig.js'); // import the connectDB function from dbConfig.js
const bodyParser = require('body-parser');


const app = express(); // express app instance
app.use(bodyParser.json()); // middleware to parse incoming JSON requests
app.use(bodyParser.urlencoded({ extended: true })); // middleware to parse incoming URL-encoded requests
app.use(express.json()); // middleware to parse incoming JSON requests

app.listen(ServerConfig.PORT,async () => {
    await connectDB(); // call the connectDB function to establish a connection to the database
    console.log(`server is running on port ${ServerConfig.PORT}`);
})