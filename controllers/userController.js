import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateToken } from "../middelware/GenerateAndVerifyToken.js";
import { status } from "../utils/system.roles.js";
import { verifyGoogleToken } from "../utils/google.strategy.js";

export const register = async (req, res) => {
  try {
    const { userName, email, password, confirmPassword, phone, role } =
      req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    try {
      const { userName, email, password, confirmPassword, phone, role } =
        req.body;

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        userName,
        email,
        phone,
        role,
        password: hashedPassword,
      });
      await newUser.save();

      res
        .status(201)
        .json({ message: "User registered successfully", newUser });
    } catch (error) {
      console.log("new user register error", error);
      res
        .status(404)
        .json({ message: "new user register error", error: error.message });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      userName,
      email,
      phone,
      role,
      password: hashedPassword,
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully", newUser });
  } catch (error) {
    console.log("new user register error", error);
    res
      .status(404)
      .json({ message: "new user register error", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.KEY_TOKEN, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "User login successfully", token });
  } catch (error) {
    console.log("Error in login:", error);
    return res
      .status(500)
      .send({ message: "Error in login", error: error.message });
  }
};

export const signupWithOAuth = async (req, res, next) => {
  const provider = req.headers["provider"]; // Expecting GOOGLE, FACEBOOK, or GITHUB
  const token = req.headers["id-token"]; // Token can be an idToken or accessToken depending on provider

  try {
    // Step 1: Verify Token
    const userData = await verifyToken(provider, token);

console.log("userData>> ",userData);

    // Step 2: Check for required fields (Example: email verification for Google)
    if (provider === "GOOGLE" && userData.email_verified !== true) {
      return res
        .status(400)
        .json({ error: "Email not verified. Use a verified Google account." });
    }

    // Step 3: Check if user already exists in database
    const existingUser = await User.findOne({
      email: userData.email,
      provider,
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User already exists. Please log in instead." });
    }

    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Step 4: Create a new user
    const newUser = new User({
      email: userData.email,
      userName: userData.name,
      password: hashedPassword,
      provider,
      status: status.online,
      token: "", // You can set this later if you want
    });

    // Step 5: Save the new user to the database
    await newUser.save();

    // Step 6: Generate JWT for the new user
    const jwtToken = generateToken({
      payload: { userId: newUser._id, email: newUser.email },
      expiresIn: "1h",
    });

    // Step 7: Update user with JWT token
    newUser.token = jwtToken;
    await newUser.save();

    // Respond with signup success and user data
    res.status(201).json({
      message: "Signup successful",
      userData: { ...userData, token: jwtToken },
    });
  } catch (error) {
    res.status(401).json({ error: error.message || "Invalid token" });
  }
};



export const loginWithOAuth = async (req, res, next) => {
  const provider = req.headers["provider"]; // Expecting GOOGLE, FACEBOOK, or GITHUB
  const receivedToken = req.headers["id-token"]; // Token can be an idToken or accessToken depending on provider

  try {
    // Step 1: Verify Token
    const userData = await verifyToken(provider, receivedToken);

    // Step 2: Check for required fields (Example: email verification for Google)
    if (provider === "GOOGLE" && userData.email_verified !== true) {
      return res
        .status(400)
        .json({ error: "Email not verified. Use a verified Google account." });
    }

    //check data by email
    const user = await User.findOne({
      email: userData.email,
      provider: "GOOGLE",
    });
    if (!user) return res.status(404).json("User Not found");
    //generate token
    const token = generateToken({
      payload: { userId: user._id, email: userData.email },
      expiresIn: 40,
    });
    //update the status to online
    user.status = status.online;
    user.token = token;
    await user.save();

    res
      .status(200)
      .json({ message: "login successfully with google", userData });

    // {
    //   "sub": "1234567890",
    //   "name": "John Doe",
    //   "given_name": "John",
    //   "family_name": "Doe",
    //   "picture": "https://example.com/johndoe.jpg",
    //   "email": "johndoe@example.com",
    //   "email_verified": true,
    //   "locale": "en"
    // }

    // Example logic: Check if user exists in DB
    // const user = await User.findOne({ googleId: userData.sub });
    // if (!user) {
    //   // Create new user in DB
    //   const newUser = new User({
    //     googleId: userData.sub,
    //     name: userData.name,
    //     email: userData.email,
    //     picture: userData.picture,
    //   });
    //   await newUser.save();
    // }
    // res.json(userData);
  } catch (error) {
    res.status(401).json({ ERROR: "Invalid token", error: error.message });
  }
};
