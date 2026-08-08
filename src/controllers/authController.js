const {loginUser} = require('../service/authService.js');
const cookieParser = require('cookie-parser');

async function login (req , res) {
    try{
        const loginPayload = req.body;
        const response = await loginUser(loginPayload);

        res.cookie('AuthToken' , response , {
            httpOnly: true,
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000
        })


        return res.status(200).json({
            success: true,
            message: "Logged in scccessfully",
            data: {} ,
            error: {}
        })
    } catch(error){
        return res.status(error.statusCode).json({
            success: false ,
            message: error.message,
            data: {} ,
            error: error.explanation
        })
    }
    
}

module.exports = {
    login
}