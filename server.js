require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://tjrcis.vercel.app"
    ],
    credentials: true
  })
);

app.use(express.json());

// MongoDB connect
mongoose.connect("mongodb+srv://saiyadayaz116:ca786caa@cluster0.oq51gtz.mongodb.net/medical?appName=Cluster0")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/appointments", require("./routes/appointmentRoutes"));



app.listen(5000, () => console.log("Server running on port 5000"));
