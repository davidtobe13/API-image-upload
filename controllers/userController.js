const userModel = require("../models/userModel")
require("dotenv").config()
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")
const cloudinary = require('../utils/cloudinary')
const axios = require('axios');

// const {DateTime} = require('luxon')
const createImageModel = require("../models/createImageModel")

// Radius of the Earth in kilometers
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY
const myIpKey = process.env.myIpKey


// Register user function
exports.registerUser = async(req,res)=>{
    try {

        // get the requirement for the registration
        const {email, password, confirmPassword}  = req.body

        const emailExist = await userModel.findOne({email})
        if (emailExist) {
            return res.status(400).json({
                error: "email already in use by another user"
            })
        }
        // comfirm if the password corresponds
        if(confirmPassword !== password){
            return res.status(400).json({
                error:"password does not match"
            })
        }
        // hash both password
        const saltPass = bcrypt.genSaltSync(10)
        const hashPass = bcrypt.hashSync(password&&confirmPassword,saltPass)
        // register the user
        const newUser = await userModel.create({
            email:email.toLowerCase(),
            password:hashPass,
            confirmPassword:hashPass
        })
        // generate a token for the user 
        const token = jwt.sign({
            userId:newUser._id,
            email:newUser.email,
        },process.env.JWT_KEY,{expiresIn:"6000s"})

       
        // throw a failure message
        if(!newUser){
            return res.status(400).json({
                error:"error creating your account"
            })
        }
        // success message
        res.status(200).json({
            message:`HELLO. YOUR ACCOUNT HAS BEEN CREATED SUCCESSFULLY`,
            data: newUser,
            token
        })

    } catch (err) {
        res.status(500).json({
            error: err.message
        })
    }
}

exports.signIn = async(req,res)=>{
    try {

        // get the requirement
        const {email,password} = req.body
        // check if the user is existing on the platform
        const userExist = await userModel.findOne({email:email.toLowerCase()})
        if(!userExist){
            return res.status(404).json({
                error:"email does not exist"
            })
        }
    
        // check for password
        const checkPassword = bcrypt.compareSync(password,userExist.password)
        if(!checkPassword){
            return res.status(400).json({
                error:"incorrect password"
            })
        }
        // generate a token for the user 
        const token = jwt.sign({
            userId:userExist._id,
            email:userExist.email,
        },process.env.JWT_KEY,{expiresIn:"20d"})

        // throw a success message
        res.status(200).json({
            message:'successfully logged in',
            data:token
        })

    } catch (err) {
        res.status(500).json({
            error: err.message
        })
    }
}

exports.signOut = async(req,res)=>{
    try {

        // get the users token
        const token = req.headers.authorization.split(' ')[1]
        if(!token){
            return res.status(400).json({
                error:"Authorization failed: token not found"
            })
        }
        // get the users id
        const userId = req.user.userId
        // find the user
        const user = await userModel.findById(userId)
        // push the user to the black list and save
        user.blackList.push(token)
        await user.save()
        // show a success response
        res.status(200).json({
            message:"successfully logged out"
        })

    } catch (err) {
        res.status(500).json({
            error: err.message
        })
    }
}




exports.createImage = async (req, res) => {
    try {
        const { userId } = req.user;

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        // Check if the user has already fired the endpoint today
        const today = new Date().toLocaleString('en-NG', {timeZone: 'Africa/Lagos', ...{ weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }});
        const previousImages = await createImageModel.find({ userId: userId, date: today });
        if (previousImages.length > 0) {
            return res.status(400).json({
                error: 'You are only allowed to upload once a day'
            });
        }
        // Get the current date and time
        const date = new Date().toLocaleString('en-NG', {timeZone: 'Africa/Lagos', ...{ weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }});
        const time = new Date().toLocaleString('en-NG', {timeZone: 'Africa/Lagos', ...{hour: '2-digit', minute: '2-digit', hourCycle: 'h24' }});
        const decodedDate = decodeURIComponent(date)


        let location;
        const ipResponse = await axios.get(`https://api.ipdata.co?api-key=${myIpKey}`);
        // const ipResponse = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=${ipApiKey}`);
        const { latitude, longitude } = ipResponse.data;
        // console.log(latitude, longitude)

        // Fetch the location based on latitude and longitude
        const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json?key=${OPENCAGE_API_KEY}&q=${latitude},${longitude}`);
        if (response.data && response.data.results && response.data.results.length > 0) {
            location = response.data.results[0].formatted;

            // console.log(location);
        } else {
            location = 'Location not available';
        }

        let mark;

        if (time <= '09:45') {
            mark = 20;
        } else if (time <= '10:00') {
            mark = 10;
        } else {
            mark = 0;
        }

        const decodedLoc = decodeURIComponent(location)

         // Upload image to Cloudinary if available
         let profileImage;
         if (req.file) {
             const file = req.file.path;
             // const result = await cloudinary.uploader.upload(file);

        const text = `Date: ${decodedDate}\nTime: ${time}\nLocation: ${decodedLoc}`;

        // Upload image with text overlay
        const result = await cloudinary.uploader.upload(file, {
            transformation: [ 
                {
                    width: 1000,
                    height: 150,
                    gravity: "south_east",
                    overlay: {
                        font_family: "arial",
                        font_size: 16,
                        text: text,
                        background: "sample",
                        padding: 50,
                        margin: 50
                    },
                    color: "white"
                }
            ]
        });
    
        profileImage = result.secure_url;
    }
    

        // Create a new image document with the updated information
        const newImage = await createImageModel.create({
            userId,
            profileImage,
            date,
            time,
            location,
            mark
        });

        if (!newImage) {
            return res.status(404).json({
                error: 'Failed to create image document'
            });
        } 

        res.status(200).json({
            message: 'Successfully created image document with image and location',
            image: newImage
        });
    } catch (error) {
        console.error('Error creating image document:', error.message);
        res.status(500).json({
            error: `Internal server error: ${error.message}`
        });
    }
};



exports.deleteAllImages = async (req, res) => {
    try {
        const { userId } = req.user;

        // Check if the user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Retrieve profile images associated with the user
        const images = await createImageModel.find({ userId: userId }, 'profileImage');

        // Check if user has any images
        if (images.length === 0) {
            return res.status(404).json({
                error: 'No images found for the user'
            });
        }

        // Extract public IDs of images
        const publicIds = images.map(image => {
            const publicId = image.profileImage.split('/').pop().split('.')[0];
            return publicId;
        });

        // Delete images from Cloudinary
        await cloudinary.api.delete_resources(publicIds);

        // Delete all images associated with the user from the database
        await createImageModel.deleteMany({ userId: userId });

        res.status(200).json({
            message: 'All images deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting images:', error.message);
        res.status(500).json({
            error: `Internal server error: ${error.message}`
        });
    }
};


exports.getAllImages = async (req, res) => {
    try {
        const { userId } = req.user;

        // Check if the user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Find all images associated with the user
        const images = await createImageModel.find({ userId: userId });

        res.status(200).json({
            message: 'Successfully retrieved all images for the user',
            images: images
        });
    } catch (error) {
        console.error('Error retrieving images:', error.message);
        res.status(500).json({
            error: `Internal server error: ${error.message}`
        });
    }
};
