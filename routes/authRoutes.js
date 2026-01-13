const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const RegistrationOTP = require("../models/RegistrationOTP");
const router = express.Router();

// SEND REGISTRATION OTP
router.post("/send-registration-otp", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail.endsWith("@gmail.com")) {
    return res.status(400).json({ message: "Only @gmail.com emails are allowed" });
  }

  if (password && password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }

  try {
    const emailExists = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });
    if (emailExists) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save/Update OTP in DB
    await RegistrationOTP.findOneAndUpdate(
      { email: normalizedEmail },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    // Send Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: "Registration OTP for Miya Huzoor",
      text: `Your OTP for registration is: ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "OTP sent to your email" });

  } catch (error) {
    console.error("Registration OTP Error:", error);
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
});

// REGISTER
router.post("/register", async (req, res) => {
  const { username, email, password, otp } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail.endsWith("@gmail.com")) {
    return res.status(400).json({ message: "Only @gmail.com emails are allowed" });
  }

  if (password && password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }

  try {
    // Verify OTP
    const otpRecord = await RegistrationOTP.findOne({ email: normalizedEmail, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if email already exists
    const emailExists = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });
    if (emailExists) {
      return res.status(400).json({ message: "Email is already taken" });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username: username?.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    await newUser.save();

    // Delete OTP record after successful registration
    await RegistrationOTP.deleteOne({ email: normalizedEmail });

    res.json({ message: "User Registered Successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const normalizedInput = usernameOrEmail?.trim().toLowerCase();

  const user = await User.findOne({
    $or: [
      { email: { $regex: new RegExp(`^${normalizedInput}$`, "i") } },
      { username: usernameOrEmail?.trim() }
    ]
  });

  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign({ id: user._id }, "SECRET123", { expiresIn: "1h" });

  res.json({
    message: "Login Successful",
    token,
    user: { id: user._id, username: user.username, email: user.email }
  });
});

// FORGOT PASSWORD - SEND OTP
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  console.log("Forgot Password Request for:", normalizedEmail);

  try {
    const user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });
    if (!user) {
      console.log("User not found in DB for email:", normalizedEmail);
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOTP = otp;
    user.resetOTPExpires = Date.now() + 600000; // 10 mins expiry
    await user.save();

    // Send Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "OTP sent to email" });

  } catch (error) {
    console.error("Forgot Password Error details:", error);
    let errorMessage = "Error sending OTP";
    if (error.code === 'EAUTH') {
      errorMessage = "Email authentication failed. Please check your EMAIL_USER and EMAIL_PASS in .env";
    }
    res.status(500).json({ message: errorMessage, error: error.message });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  try {
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") },
      resetOTP: otp,
      resetOTPExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });

  } catch (error) {
    res.status(500).json({ message: "Error resetting password" });
  }
});

// GET ALL USERS (FOR ADMIN)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "username email createdAt");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

module.exports = router;