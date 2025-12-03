const express  = require("express")
const router  = express.Router()

const {body} = require("express-validator")
const {register, verifyEmail, login, logout, refreshToken, forgotPassword, resetPassword} = require("./auth.controller")
router.post("/register",
    body('email').isEmail(),
    body('password').isLength({min: 6}),
    register
)

router.get("/verify-email", verifyEmail)
router.post("/login",
    body("email").isEmail(),
    body("password").isLength({min: 6}),
 login)
router.post("/logout", logout)
router.post("/refresh", refreshToken)
router.post("/forgot-password",
    body('email').isEmail(),
    forgotPassword
)
router.post("/reset-password",
    body('password').isLength({min: 8}),
    body('token').notEmpty(),
    resetPassword
)
module.exports = router; 