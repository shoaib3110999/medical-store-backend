const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    fatherName: { type: String, required: true },
    email: { type: String, required: true },
    gender: { type: String, required: true },
    date: { type: Date, required: true },
    age: { type: Number, required: true },
    contact: { type: String, required: true },
    address: { type: String, required: true },
    country: { type: String, required: true },
    service: { type: String, required: true },
    schedule: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Complete'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Appointment", appointmentSchema);
