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
  try {
    // 1️⃣ Extract latitude & longitude from query
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and longitude required" });
    }

    // 2️⃣ Convert to numbers (query params are strings)
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // 3️⃣ Find nearby exchange requests
    const requests = await ExchangeRequest.find({
      requester: { $ne: req.user._id }, // not my own request
      status: "CREATED",
      expiresAt: { $gt: new Date() },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: 5000, // meters (5 km)
        },
      },
    }).populate("requester", "name email");

    // 4️⃣ Send response
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Accept Exchange Request
export const acceptExchangeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const currentUserId = req.user._id;

    // Find the request by ID
    const exchangeRequest = await ExchangeRequest.findById(requestId);

    if (!exchangeRequest) {
      return res.status(404).json({ message: "Exchange request not found" });
    }

    //  Cannot accept your own request
    if (exchangeRequest.requester.toString() === currentUserId.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot accept your own request" });
    }

    //  Only CREATED requests can be accepted
    if (exchangeRequest.status !== "CREATED") {
      return res
        .status(400)
        .json({ message: "This request is no longer available" });
    }

    // // Optional: Check if current user already has an active accepted request
    // const activeAccepted = await ExchangeRequest.findOne({
    //   helper: currentUserId,
    //   status: "ACCEPTED",
    // });
    // if (activeAccepted) {
    //   return res
    //     .status(400)
    //     .json({ message: "You already have an active accepted request" });
    // }

    // 5️⃣ Accept the request
    exchangeRequest.helper = currentUserId;
    exchangeRequest.status = "ACCEPTED";
    exchangeRequest.acceptedAt = new Date(); // optional timestamp

    await exchangeRequest.save();

    res.json({
      message: "Request accepted successfully",
      exchangeRequest,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};





// Complete Exchange Request
export const completeExchangeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const currentUserId = req.user._id;

    // 1️⃣ Find the request by ID
    const exchangeRequest = await ExchangeRequest.findById(requestId);

    if (!exchangeRequest) {
      return res.status(404).json({ message: "Exchange request not found" });
    }

    // 2️⃣ Only helper can complete the request
    if (
      !exchangeRequest.helper ||
      exchangeRequest.helper.toString() !== currentUserId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Only the assigned helper can complete this request" });
    }

    // 3️⃣ Only ACCEPTED requests can be completed
    if (exchangeRequest.status !== "ACCEPTED") {
      return res
        .status(400)
        .json({ message: "This request cannot be completed" });
    }

    // 4️⃣ Complete the request
    exchangeRequest.status = "COMPLETED";
    exchangeRequest.completedAt = new Date(); // optional timestamp

    await exchangeRequest.save();

    res.json({
      message: "Request completed successfully",
      exchangeRequest,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};





  

export const cancelExchangeRequest = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};
