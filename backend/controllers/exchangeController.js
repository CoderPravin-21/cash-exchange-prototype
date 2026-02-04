import ExchangeRequest from "../models/ExchangeRequest.js";

export const createExchangeRequest = async (req, res) => {
  try {
    const { amount, exchangeType, latitude, longitude, expiresInMinutes } =
      req.body;

    // 1️⃣ Validation
    if (!amount || !exchangeType || !latitude || !longitude) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 2️⃣ One active request rule
    const existingRequest = await ExchangeRequest.findOne({
      requester: req.user._id,
      status: { $in: ["CREATED", "ACCEPTED"] },
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: "You already have an active request" });
    }

    // 3️⃣ Expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + (expiresInMinutes || 30)
    );

    // 4️⃣ Create request
    const request = await ExchangeRequest.create({
      requester: req.user._id,
      amount,
      exchangeType,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      expiresAt,
    });

    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


export const getNearbyRequests = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

export const acceptExchangeRequest = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

export const completeExchangeRequest = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

export const cancelExchangeRequest = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};
