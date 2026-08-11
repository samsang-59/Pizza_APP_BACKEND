const express = require('express');
const ServerConfig = require('./config/serverConfig.js');
const { connectDB } = require('./config/dbConfig.js'); // import the connectDB function from dbConfig.js
const bodyParser = require('body-parser');
const userRouter = require('./routes/userRoute.js');
const authRouter = require('./routes/authRoute.js');
const cookieParser = require('cookie-parser');
const uploader = require('./middlewares/multer_middleware.js');
const cloudinary = require('./config/cloudinaryConfig.js')
const fs = require('fs/promises');


const app = express(); // express app instance
app.use(bodyParser.json()); // middleware to parse incoming JSON requests
app.use(bodyParser.urlencoded({ extended: true })); // middleware to parse incoming URL-encoded requests
app.use(express.json()); // middleware to parse incoming JSON requests
app.use(cookieParser()); // middleware to parse cookies from incoming requests

app.use('/user' , userRouter);
app.use('/login' , authRouter);

app.post('/photo' , uploader.single('photo'), async (req , res) => {
    if (!req.file) {
        return res.status(400).json({
            message: 'no file received - check that "photo" is sent as a File field'
        })
    }
    const result = await cloudinary.uploader.upload(req.file.path);
    await fs.unlink(req.file.path);
    return res.json({
        message: 'ok',
        file: req.file,
        cloudinary: result
    })
});

app.listen(ServerConfig.PORT,async () => {
    await connectDB(); // call the connectDB function to establish a connection to the database
    console.log(`server is running on port ${ServerConfig.PORT}`);
})