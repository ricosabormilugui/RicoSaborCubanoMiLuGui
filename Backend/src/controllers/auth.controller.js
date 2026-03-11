import { createAuthToken } from "../utils/auth-token.js";

const usersByEmail = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getAdminCredentials() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || "";
  return { email, password };
}

export async function register(req, res) {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "").trim();

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }

  if (usersByEmail.has(email)) {
    return res.status(409).json({ error: "User already exists" });
  }

  usersByEmail.set(email, { name, email, password, role: "customer" });
  return res.status(201).json({ created: true });
}

export async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "").trim();

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const admin = getAdminCredentials();
  if (email === admin.email && password === admin.password && admin.email && admin.password) {
    const token = createAuthToken({ email, role: "admin" });
    return res.json({ token, role: "admin" });
  }

  const user = usersByEmail.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createAuthToken({ email: user.email, role: user.role, name: user.name });
  return res.json({ token, role: user.role, name: user.name });
}
