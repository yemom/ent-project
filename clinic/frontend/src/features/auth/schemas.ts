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

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address')
});
