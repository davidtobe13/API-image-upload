const userModel = require("../models/userModel")
require("dotenv").config()
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")
const cloudinary = require('../utils/cloudinary')
const axios = require('axios');

const {DateTime} = require('luxon')

// Radius of the Earth in kilometers
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY
const ipApiKey = process.env.ipApiKey
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

        if (!userId) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Get the current date and time
        const date = DateTime.now().toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
        const time = DateTime.now().toLocaleString({ hour: '2-digit', minute: '2-digit' });

        // Upload image to Cloudinary if available
        let profileImage;
        if (req.file) {
            const file = req.file.path;
            const result = await cloudinary.uploader.upload(file);
            profileImage = result.secure_url;
        }

        // Get user's current location from IP geolocation
        let location;
        const ipResponse = await axios.get(`https://api.ipdata.co?api-key=${myIpKey}`);
        // const ipResponse = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=${ipApiKey}`);
        const { latitude, longitude } = ipResponse.data;
        console.log(latitude, longitude)

        // Fetch the location based on latitude and longitude
        const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json?key=${OPENCAGE_API_KEY}&q=${latitude},${longitude}`);
        if (response.data && response.data.results && response.data.results.length > 0) {
            location = response.data.results[0].formatted;

            console.log(location);
        } else {
            location = 'Location not available';
        }

        // Create a new user document with the updated information
        const newUser = await userModel.create({
            userId,
            profileImage,
            date,
            time,
            location
        });

        if (!newUser) {
            return res.status(404).json({
                error: 'Failed to create user document'
            });
        }

        res.status(200).json({
            message: 'Successfully created user document with image and location',
            user: newUser
        });
    } catch (error) {
        console.error('Error creating user document:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
};


