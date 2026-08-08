const UserRepository = require('../repositories/userRepository.js');
const { registerUser } = require('../service/userService.js');

async function createUser(req , res ) {
    console.log("controller called");
    console.log(req.body);
   

    try{
        const response = await registerUser(req.body);
        return res.json({
        message: 'Successfully created user',
        success: true ,
        data: response , 
        error: {}
        })
    } catch(error) {
       return res.status(error.statusCode).json({
        success: false ,
        message: error.reason,
        data: {} ,
        error: error
       })
    }

}

module.exports = {
    createUser
}