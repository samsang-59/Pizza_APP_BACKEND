const jwt = require('jsonwebtoken');
const {JWT_SECRET} = require('../config/serverConfig.js');

function authValidator(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required",
            data: {},
            error: 'Validation failed'
        });
    }

    next();
}

async function isLoggedIn(req , res , next) {
    const token = req.cookies.AuthToken;

    if(!token) {
        return res.status(401).json({
            success: false,
            message: "No auth token provided",
            data: {},
            error: 'Not Authenticated'
        });
    }

    const decoded = jwt.verify(token , JWT_SECRET);

    if(!decoded) {
        return res.status(401).json({
            success: false,
            message: "No auth token provided",
            data: {},
            error: 'Not Authenticated'
        });
    }

    // if reached here then user is authenticated allow them to access the api
    req.user = {
        email: decoded.email,
        id: decoded.id
    }

    next();

}

module.exports = {
    authValidator,
    isLoggedIn
}
