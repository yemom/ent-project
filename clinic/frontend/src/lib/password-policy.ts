import { z } from 'zod';

export const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=[\]{}:;"'.,<>~/\\|]).{8,}$/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include a letter, a number, and a special character';

export const passwordFieldSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MESSAGE);

export function isStrongPassword(value: string) {
  return PASSWORD_REGEX.test(value);
}

export const passwordFormRules = {
  required: 'Password is required',
  minLength: { value: 8, message: 'Password must be at least 8 characters' },
  validate: (value: string) => isStrongPassword(value) || PASSWORD_REQUIREMENTS_MESSAGE
} as const;
