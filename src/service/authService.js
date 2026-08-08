const {findUser} = require('../repositories/userRepository.js')
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const {JWT_SECRET , JWT_EXPIRY} = require('../config/serverConfig.js');

async function loginUser(authDetails) {
    const email = authDetails.email;
    const plain_password = authDetails.password;

    // check if there is a registered user with the given email
    const user = await findUser({email});

    if(!user) {
        throw {message:'No user found with the given email' , statusCode:404};
    }
    
    // if the user is found we need to compare plainIncomingPassword with hashedPassword
    const isPasswordValidated = await bcrypt.compare(plain_password , user.password);

    if(!isPasswordValidated) {
        throw {
            message: 'Password is incorrect',
            statusCode: 401
        }
    }

    // if the password is validated  , create a token and return it
    const token = jwt.sign({
        email: user.email,
        id: user.id
    } ,JWT_SECRET , {expiresIn: JWT_EXPIRY} );

    return token;
}

module.exports = {
    loginUser
}