import { z } from 'zod';
import { passwordFieldSchema } from '@/lib/password-policy';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: passwordFieldSchema,
  role: z.enum(['ADMIN', 'DOCTOR', 'PATIENT'])
});

/**
 * Mirrors `PasswordPolicy.REGEX` on the server.
 *
 * <p>Enforced on both sides: the browser copy is for immediate feedback, and the
 * server copy is the one that counts. A client that skips this check still cannot
 * set a password the backend rejects.
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address')
});

export const resetPasswordSchema = z
  .object({
    newPassword: passwordFieldSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password')
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match'
  });
