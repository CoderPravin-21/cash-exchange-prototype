import User from "../models/User.js";

import generateToken from "../utils/generateToken.js";

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, location } = req.body;

    // 1. validation
    if (!name || !email || !password || !phone || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. check existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3. create user (password auto-hashed)
    const user = await User.create({
      name,
      email,
      password,
      phone,
      location
    });

    // 4. generate token
    const token = generateToken(user._id);

    // 5. response
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. validation
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. check user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 4. generate token
    const token = generateToken(user._id);

    // 5. response
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

