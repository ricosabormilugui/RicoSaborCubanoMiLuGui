import { verifyPassword } from "../lib/auth.js";
import { findUserByEmail } from "../repositories/users.repository.js";

export async function authenticateCredentials(email, password, { findUser = findUserByEmail } = {}) {
  const user = await findUser(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}
