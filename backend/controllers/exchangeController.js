
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


// Accept Exchange Request with Race Condition & Amount Compatibility (ESM)
export const acceptExchangeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const currentUserId = req.user._id;

    // 1️⃣ Fetch the request to be accepted
    const targetRequest = await ExchangeRequest.findById(requestId);
    if (!targetRequest) {
      return res.status(404).json({ message: "Exchange request not found" });
    }

    // 2️⃣ Prevent accepting own request
    if (targetRequest.requester.toString() === currentUserId.toString()) {
      return res.status(400).json({ message: "You cannot accept your own request" });
    }

    // 3️⃣ Only CREATED requests can be accepted
    if (targetRequest.status !== "CREATED") {
      return res.status(400).json({ message: "This request is no longer available" });
    }

    // 4️⃣ Fetch helper's own active request
    const helperRequest = await ExchangeRequest.findOne({
      requester: currentUserId,
      status: "CREATED",
    });

    if (!helperRequest) {
      return res.status(400).json({
        message: "You must have an active exchange request to accept others",
      });
    }

    // 5️⃣ Exchange type must be opposite
    const isCompatibleType =
      targetRequest.exchangeType === "ONLINE_TO_CASH" &&
      helperRequest.exchangeType === "CASH_TO_ONLINE" ||
      targetRequest.exchangeType === "CASH_TO_ONLINE" &&
      helperRequest.exchangeType === "ONLINE_TO_CASH";

    if (!isCompatibleType) {
      return res.status(400).json({
        message: "Exchange types are not compatible",
      });
    }

    // 6️⃣ Amount compatibility check
    if (helperRequest.amount < targetRequest.amount) {
      return res.status(400).json({
        message: "Your request amount is insufficient to fulfill this exchange",
      });
    }

    // 7️⃣ Atomic accept to prevent race condition
    const updatedRequest = await ExchangeRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: "CREATED",
        requester: { $ne: currentUserId },
        helper: { $exists: false },
      },
      {
        $set: {
          status: "ACCEPTED",
          helper: currentUserId,
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(400).json({
        message: "Request already accepted by another user",
      });
    }

    res.json({
      message: "Request accepted successfully",
      exchangeRequest: updatedRequest,
    });

  await ExchangeRequest.findByIdAndUpdate(helperRequest._id, {
  status: "LOCKED",
  linkedRequest: updatedRequest._id
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

    await ExchangeRequest.updateOne(
  { linkedRequest: exchangeRequest._id },
  { status: "COMPLETED" }
);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



export const cancelExchangeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const currentUserId = req.user._id;

    // 1️⃣ Find the request by ID
    const exchangeRequest = await ExchangeRequest.findById(requestId);

    if (!exchangeRequest) {
      return res.status(404).json({ message: "Exchange request not found" });
    }

    // 2️⃣ Only requester can cancel the request
    if (exchangeRequest.requester.toString() !== currentUserId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the requester can cancel this request" });
    }
    if (exchangeRequest.status !== "CREATED") {
  return res.status(400).json({
    message: "Only unaccepted requests can be cancelled"
  });
}


    // 3️⃣ Cancel the request
    exchangeRequest.status = "CANCELLED";
    exchangeRequest.cancelledAt = new Date(); // optional timestamp

    await exchangeRequest.save();

    res.json({
      message: "Request cancelled successfully",
      exchangeRequest,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



// Discover compatible helpers near me
export const discoverHelpers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lat, lng, maxDistance = 5000 } = req.query;

    if (lat == null || lng == null) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    // 1️⃣ Get current user's active request
    const myRequest = await ExchangeRequest.findOne({
      requester: userId,
      status: "CREATED",
      expiresAt: { $gt: new Date() },
    });

    if (!myRequest) {
      return res.status(400).json({
        message: "You must have an active exchange request to discover helpers",
      });
    }

    // 2️⃣ Determine opposite exchange type
    const oppositeType =
      myRequest.exchangeType === "CASH_TO_ONLINE"
        ? "ONLINE_TO_CASH"
        : "CASH_TO_ONLINE";

    // 3️⃣ Find compatible nearby requests
    const helpers = await ExchangeRequest.find({
      requester: { $ne: userId },
      status: "CREATED",
      exchangeType: oppositeType,
      amount: { $gte: myRequest.amount },
      expiresAt: { $gt: new Date() },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: Number(maxDistance),
        },
      },
    }).populate("requester", "name email");

    // 4️⃣ Response
    res.json({
      myRequest: {
        id: myRequest._id,
        amount: myRequest.amount,
        exchangeType: myRequest.exchangeType,
      },
      count: helpers.length,
      helpers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
