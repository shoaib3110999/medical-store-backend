const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const RegistrationOTP = require("../models/RegistrationOTP");

const router = express.Router();

/* =========================
   EMAIL TRANSPORTER (REUSE)
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // APP PASSWORD
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((err) => {
  if (err) console.error("Email transporter error:", err);
  else console.log("✅ Email server ready");
});

/* =========================
   SEND REGISTRATION OTP
========================= */
router.post("/send-registration-otp", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.endsWith("@gmail.com")) {
      return res
        .status(400)
        .json({ message: "Only @gmail.com emails allowed" });
    }

    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const emailExists = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") },
    });

    if (emailExists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await RegistrationOTP.findOneAndUpdate(
      { email: normalizedEmail },
      { otp, expiresAt: Date.now() + 10 * 60 * 1000 },
      { upsert: true, new: true },
    );

    await transporter.sendMail({
      from: `"Miya Huzoor" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Registration OTP",
      text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* =========================
   REGISTER USER
========================= */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, otp } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    const otpRecord = await RegistrationOTP.findOne({
      email: normalizedEmail,
      otp,
      expiresAt: { $gt: Date.now() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const emailExists = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") },
    });

    if (emailExists) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    await RegistrationOTP.deleteOne({ email: normalizedEmail });

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const normalized = usernameOrEmail.trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${normalized}$`, "i") } },
        { username: usernameOrEmail.trim() },
      ],
    });

    if (!user) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
});

/* =========================
   FORGOT PASSWORD - SEND OTP
========================= */
router.post("/forgot-password", async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOTP = otp;
    user.resetOTPExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: `"Miya Huzoor" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Password Reset OTP",
      text: `Your password reset OTP is ${otp}. Valid for 10 minutes.`,
    });

    res.json({ message: "OTP sent for password reset" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Failed to send reset OTP" });
  }
});

/* =========================
   RESET PASSWORD
========================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") },
      resetOTP: otp,
      resetOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: "Password reset failed" });
  }
});

/* =========================
   ADMIN - GET USERS
========================= */
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "username email createdAt");
    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;
