import express from "express";
import { registerUser , loginUser} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { getMe } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/me", protect, getMe);

export default router;
