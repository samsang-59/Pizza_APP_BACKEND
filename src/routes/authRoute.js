const express = require('express');
const {login} = require('../controllers/authController.js');
const {authValidator, isLoggedIn} = require('../validation/authValidator.js');

const authRouter = express.Router();

authRouter.post('/' , authValidator, isLoggedIn, login);

module.exports = authRouter;