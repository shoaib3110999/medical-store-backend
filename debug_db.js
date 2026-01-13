const mongoose = require("mongoose");
const fs = require("fs");

const debugDB = async () => {
    try {
        await mongoose.connect("mongodb://localhost:27017/authDB");
        const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
        const users = await User.find({}, "username email");
        fs.writeFileSync("debug_results.json", JSON.stringify(users, null, 2));
        console.log("Results written to debug_results.json");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugDB();
