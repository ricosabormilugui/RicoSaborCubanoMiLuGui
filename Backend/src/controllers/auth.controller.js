import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { getRequiredEnv } from "../lib/env.js";
import { createUser, findUserByEmail } from "../repositories/users.repository.js";

export async function registerCustomer(req, res) {
  try {
    const { fullName, email, password } = req.body ?? {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "fullName, email and password are required" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = hashPassword(password);
    const user = await createUser({ fullName, email, passwordHash, role: "customer" });

    return res.status(201).json({
      userId: String(user._id),
      email: user.email,
      fullName: user.fullName
    });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function loginCustomer(req, res) {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user || user.role !== "customer" || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ sub: String(user._id), role: "customer", email: user.email });
    return res.status(200).json({ token, userId: String(user._id), role: "customer" });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body ?? {};
    const expectedEmail = getRequiredEnv("ADMIN_EMAIL");
    const expectedPassword = getRequiredEnv("ADMIN_PASSWORD");

    if (email !== expectedEmail || password !== expectedPassword) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const token = signToken({ sub: "admin", role: "admin", email });
    return res.status(200).json({ token, role: "admin" });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
