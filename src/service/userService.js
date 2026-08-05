class UserService {

    constructor(userRepository){
        //  in the argument we will expect an userRepository object
        this.userRepository = userRepository;
    }

    async registerUser(userDetails){
        // it will create a brand new user in the db

        // 1. we need to check if the user with this emial and mobile number already exists or not
        const user = await this.userRepository.findUser({
            email: userDetails.email ,
            mobileNumber: userDetails.mobileNumber
        })

        if(user){
            // we found a user
            throw {reason: 'user with the given email and mobile number already exist' , statusCode: 400};
        } 

        // 2. if not then create the user in the database
        if(!user){
            const newUser = await this.userRepository.createUser({
                email: userDetails.email , 
                password: userDetails.password , 
                firstName: userDetails.firstName ,
                lastName: userDetails.lastName,
                mobileNumber: userDetails.mobileNumber
            })
        }

        if(!newUser){
            throw {reason: 'something went wrong cannot create user' , statusCode: 500};
        }

        // 3. return the details of the created user
        return newUser;

    }
}

module.exports = UserService;