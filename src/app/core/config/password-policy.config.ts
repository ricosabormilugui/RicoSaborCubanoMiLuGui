export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE =
  `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres e incluir al menos una letra y un número.`;

export function getPasswordPolicyError(password: string): string {
  const valid =
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) &&
    /\d/.test(password);

  return valid ? '' : PASSWORD_POLICY_MESSAGE;
}
