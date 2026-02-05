import express from "express";
const router = express.Router();

import {
  createExchangeRequest,
  getNearbyRequests,
  acceptExchangeRequest,
  completeExchangeRequest,
  cancelExchangeRequest,
  discoverHelpers,
} from "../controllers/exchangeController.js";

import protect from "../middleware/authMiddleware.js";

router.post("/", protect, createExchangeRequest);
router.get("/nearby", protect, getNearbyRequests);
router.post("/:id/accept", protect, acceptExchangeRequest);
router.post("/:id/complete", protect, completeExchangeRequest);
router.post("/:id/cancel", protect, cancelExchangeRequest);
router.get("/helpers", protect, discoverHelpers);

export default router;
