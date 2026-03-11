import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { getRequiredEnv } from "../lib/env.js";
import {
  createUser,
  findUserByEmail,
  promoteUserToAdmin
} from "../repositories/users.repository.js";
import { linkGuestOrdersByEmailToUser } from "../repositories/orders.repository.js";

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
    const linkedOrders = await linkGuestOrdersByEmailToUser(user.email, String(user._id));

    return res.status(201).json({
      userId: String(user._id),
      email: user.email,
      fullName: user.fullName,
      linkedOrders
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
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const expectedEmail = process.env.ADMIN_EMAIL;
    const expectedPassword = process.env.ADMIN_PASSWORD;
    const hasEnvAdmin =
      Boolean(expectedEmail?.trim()) &&
      Boolean(expectedPassword?.trim()) &&
      email === expectedEmail &&
      password === expectedPassword;

    let adminEmail = email;

    if (!hasEnvAdmin) {
      const user = await findUserByEmail(email);
      if (!user || user.role !== "admin" || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid admin credentials" });
      }

      adminEmail = user.email;
    }

    const token = signToken({ sub: `admin:${adminEmail}`, role: "admin", email: adminEmail });
    return res.status(200).json({ token, role: "admin" });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function promoteAdmin(req, res) {
  try {
    const { email, bootstrapKey } = req.body ?? {};
    if (!email || !bootstrapKey) {
      return res.status(400).json({ error: "email and bootstrapKey are required" });
    }

    const expectedBootstrapKey = getRequiredEnv("ADMIN_BOOTSTRAP_KEY");
    if (bootstrapKey !== expectedBootstrapKey) {
      return res.status(401).json({ error: "Invalid bootstrap key" });
    }

    const promoted = await promoteUserToAdmin(email);
    if (!promoted) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ promoted: true, email: promoted.email, role: promoted.role });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function getCustomerSession(req, res) {
  try {
    return res.status(200).json({
      userId: req.auth?.sub,
      email: req.auth?.email,
      role: req.auth?.role ?? "customer"
    });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
