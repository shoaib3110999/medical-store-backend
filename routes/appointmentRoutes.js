const express = require("express");
const Appointment = require("../models/Appointment");
const router = express.Router();

// CREATE
router.post("/", async (req, res) => {
    try {
        const newAppointment = new Appointment(req.body);
        await newAppointment.save();
        res.status(201).json({ message: "Appointment booked successfully", data: newAppointment });
    } catch (error) {
        res.status(500).json({ message: "Error booking appointment", error: error.message });
    }
});

// READ (ALL)
router.get("/", async (req, res) => {
    try {
        const appointments = await Appointment.find().sort({ createdAt: -1 });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching appointments", error: error.message });
    }
});

// UPDATE
router.put("/:id", async (req, res) => {
    try {
        const updatedAppointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ message: "Appointment updated successfully", data: updatedAppointment });
    } catch (error) {
        res.status(500).json({ message: "Error updating appointment", error: error.message });
    }
});

// DELETE
router.delete("/:id", async (req, res) => {
    try {
        await Appointment.findByIdAndDelete(req.params.id);
        res.json({ message: "Appointment deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting appointment", error: error.message });
    }
});

module.exports = router;
