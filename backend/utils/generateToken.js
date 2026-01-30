import jwt from "jsonwebtoken";

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },          // payload
    process.env.JWT_SECRET, // secret key
    { expiresIn: "7d" }     // token expiry
  );
};

export default generateToken;
