const router = require("express").Router()
const { registerUser, signIn, signOut, createImage } = require("../controllers/userController")
const { authenticate } = require("../middlewares/authentication")
const upload = require("../utils/multer")

router.post("/register-user", registerUser)
router.post("/sign-in",signIn)
router.post("/sign-out", signOut)
router.post("/upload-image", upload.single("profileImage"),authenticate ,createImage)

module.exports = router
