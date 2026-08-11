const mongoose = require('mongoose');
const { applyTimestamps } = require('./userSchema');


const productSchema = new mongoose.model({
    productName: {
        type: String , 
        required: [true , 'product name is required'],
        minLength: [5 , 'product name must be atleast 5 characters'],
        trim: true
    },

    description: {
        type: String,
        minLength: [5 , 'product description must be atleast 5 characters'],
    },

    productImage: {
        type: String,

    },

    price: {
        type: Number,
        required: [true , 'product price is required']
    },

    category: {
        type: String,
        enum: ['veg' , 'non-veg' , 'sides' , 'drinks'],
        default: 'veg'
    },

    inStock: {
        type: Boolean,
        required: [true , 'In stock status is required'],
        default: true
    },



} , {timestamps: true});

const product = mongoose.model('product' , productSchema);

module.exports = product;
