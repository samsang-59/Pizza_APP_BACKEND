const express = require('express');
const {createUser} = require('../controllers/userController.js')

// we have to intialize a router object to add routes int a new file
// routers are used for segregating your routes into different modules
const UserRouter = express.Router();


UserRouter.post('/' , createUser);

module.exports = UserRouter;  // exporting the router