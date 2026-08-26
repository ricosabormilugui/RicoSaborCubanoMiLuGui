export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE =
  `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres e incluir al menos una letra y un número.`;

const LETTER_PATTERN = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
const NUMBER_PATTERN = /\d/;

export interface PasswordPolicyCheck {
  id: 'length' | 'letter' | 'number';
  label: string;
  met: boolean;
}

export function getPasswordPolicyChecks(password: string): PasswordPolicyCheck[] {
  return [
    {
      id: 'length',
      label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} caracteres`,
      met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH
    },
    { id: 'letter', label: 'Una letra', met: LETTER_PATTERN.test(password) },
    { id: 'number', label: 'Un número', met: NUMBER_PATTERN.test(password) }
  ];
}

export function getPasswordPolicyError(password: string): string {
  return getPasswordPolicyChecks(password).every((check) => check.met) ? '' : PASSWORD_POLICY_MESSAGE;
}
