const mongoose = require('mongoose');
const Appointment = require('./models/Appointment');

// Update this with your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/miya';

async function migrateAppointments() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Update all appointments that don't have a status field
        const result = await Appointment.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'Pending' } }
        );

        console.log(`Migration completed: ${result.modifiedCount} appointments updated`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateAppointments();
