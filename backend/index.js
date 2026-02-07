import cron from "node-cron";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import authRoutes from "./routes/authRoutes.js";
import exchangeRoutes from "./routes/exchangeRoutes.js";
import ExchangeRequest from "./models/ExchangeRequest.js";
import { discoverHelpers } from "./controllers/exchangeController.js";


dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

app.use("/api/auth",authRoutes); 
app.use("/api/exchange",exchangeRoutes);


// database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));


cron.schedule('0 * * * *', async () => {
  await ExchangeRequest.updateMany(
    { status: 'CREATED', expiresAt: { $lte: new Date() } },
    { $set: { status: 'EXPIRED' } }
  );
  console.log('Expired requests updated');
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
