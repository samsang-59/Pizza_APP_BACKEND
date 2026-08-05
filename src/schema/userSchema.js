const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String ,
        required: [true , 'First name is required'],
        minLength: [5 , 'First name must be at least 5 character long'],
        lowercase: true,
        trim: true,
        maxLength: [20 , 'first name should be less than or eqal to 20 characters']
    },

    lastName: {
        type: String ,
        required: [true , 'Last name is required'],
        minLength: [5 , 'Last name must be at least 5 character long'],
        lowercase: true,
        trim: true,
        maxLength: [20 , 'last name should be less than or eqal to 20 characters']
    },

    mobileNumber: {
        type: String ,
        trim: true,
        unique: [true , "phone number is already in use"],
        required: [true , 'Mobile number should be provided'],

    },

    email: {
        type: String,
        trim: true,
        required: [true , 'email should be provided'],
        unique: [true , "email is already in use"],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    } ,

    password: {
        type: String , 
        required: [true , 'password should be provided'],
        minLength: [6 , "password should be minimum 6 character long"]

    }

} , {timestamps: true});

const user = mongoose.model('user' , userSchema);
module.exports = user;