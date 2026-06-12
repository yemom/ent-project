"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type FormEvent } from "react";
import { Mail, Lock, Chrome, KeyRound, Eye, EyeOff } from "lucide-react";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
} from "@/features/auth/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { z } from "zod";

function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Brand/Features */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <div className="text-3xl font-bold mb-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              ⚕️
            </div>
            clinic
          </div>
          <p className="text-white/80">Healthcare Suite</p>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Next-Gen Patient Management
          </h2>
          <p className="text-white/90 mb-8 max-w-md">
            Experience the clarity of data-driven healthcare with clinic's
            proprietary Glass-UI architecture.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                ✓
              </div>
              <div>
                <p className="font-semibold">HIPAA Compliant</p>
                <p className="text-sm text-white/80">
                  Secure patient data management
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                ✓
              </div>
              <div>
                <p className="font-semibold">Real-time Sync</p>
                <p className="text-sm text-white/80">
                  Instant updates across all devices
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                ✓
              </div>
              <div>
                <p className="font-semibold">Role-Based Access</p>
                <p className="text-sm text-white/80">
                  Admin, Doctor, and Patient portals
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-white/30 border-2 border-white"></div>
            <div className="w-10 h-10 rounded-full bg-white/30 border-2 border-white"></div>
            <div className="w-10 h-10 rounded-full bg-white/30 border-2 border-white"></div>
          </div>
          <div>
            <p className="text-sm font-semibold">Join 10,000+ professionals</p>
            <p className="text-xs text-white/80">Who trust clinic daily</p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex items-center justify-center p-4 sm:p-8 bg-white">
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const login = useLogin();
  const [userType, setUserType] = useState<"staff" | "patient">("staff");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = await form.trigger();
    if (isValid) {
      login.mutate(form.getValues());
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">clinic</h1>
          <p className="text-sm text-gray-600">
            Secure access to your high-performance healthcare suite.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setUserType("staff")}
            className={`pb-4 font-medium text-sm transition-colors ${
              userType === "staff"
                ? "text-teal-600 border-b-2 border-teal-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Staff Login
          </button>
          <button
            onClick={() => setUserType("patient")}
            className={`pb-4 font-medium text-sm transition-colors ${
              userType === "patient"
                ? "text-teal-600 border-b-2 border-teal-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Patient Portal
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {login.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {getFriendlyErrorMessage(login.error, 'Unable to sign in. Please check your email and password.')}
            </div>
          ) : null}

          {/* Email/Medical ID Field */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {userType === "staff" ? "Email Address" : "Medical ID or Email"}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type="email"
                placeholder={
                  userType === "staff"
                    ? "dr.smith@clinic.com"
                    : "dr.smith@clinic.com"
                }
                className="pl-10 h-11 border-gray-300 rounded-lg"
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Security Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10 h-11 border-gray-300 rounded-lg"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-gray-700">
                Keep me authenticated for 24 hours
              </span>
            </label>
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <Button
            type="submit"
            disabled={login.isPending}
            className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {login.isPending ? "Signing in..." : "Sign In →"}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="text-sm text-gray-600">OR CONTINUE WITH</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 h-11 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <Chrome className="h-5 w-5" />
            Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 h-11 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <KeyRound className="h-5 w-5" />
            Passkey
          </button>
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-between text-xs text-gray-600 mt-8 pt-6 border-t border-gray-200">
          <Link href="#" className="hover:text-gray-900">
            Privacy Protocol
          </Link>
          <span>•</span>
          <Link href="#" className="hover:text-gray-900">
            HIPAA Compliance
          </Link>
        </div>

        <div className="text-center text-sm text-gray-600 mt-4">
          Don&apos;t have an account?{" "}
          {/* Link to the registration page for new users */}
          <Link
            href="/register"
            className="font-medium text-teal-700 hover:text-teal-800"
          >
            Sign up
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const register = useRegister();
  const [signUpAs, setSignUpAs] = useState<"DOCTOR" | "PATIENT">("DOCTOR");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", role: signUpAs },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = await form.trigger();
    if (isValid) {
      register.mutate({ ...form.getValues(), role: signUpAs });
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">clinic</h1>
          <p className="text-sm text-gray-600">Create your account</p>
          <p className="text-xs text-gray-600 mt-1">
            Start managing your healthcare journey today.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Full Name
            </label>
            <Input
              placeholder="Dr. Julian Smith"
              className="h-11 border-gray-300 rounded-lg"
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="julian.smith@clinic.com"
              className="h-11 border-gray-300 rounded-lg"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, letter, number & symbol"
                className="pr-10 h-11 border-gray-300 rounded-lg"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Sign Up As */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              I am signing up as:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSignUpAs("DOCTOR")}
                className={`p-4 rounded-lg border-2 transition-all text-sm font-medium ${
                  signUpAs === "DOCTOR"
                    ? "border-teal-600 bg-teal-50 text-teal-900"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                <div className="text-lg mb-1">👨‍⚕️</div>
                Healthcare Staff
              </button>
              <button
                type="button"
                onClick={() => setSignUpAs("PATIENT")}
                className={`p-4 rounded-lg border-2 transition-all text-sm font-medium ${
                  signUpAs === "PATIENT"
                    ? "border-teal-600 bg-teal-50 text-teal-900"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                <div className="text-lg mb-1">👤</div>
                Patient
              </button>
            </div>
          </div>

          {/* Create Account Button */}
          <Button
            type="submit"
            disabled={register.isPending}
            className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium transition-colors mt-6"
          >
            {register.isPending ? "Creating account..." : "Create Account →"}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="text-sm text-gray-600">Or continue with</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 h-11 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <Chrome className="h-5 w-5" />
            Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 h-11 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <KeyRound className="h-5 w-5" />
            Passkey
          </button>
        </div>

        {/* Footer Links */}
        <div className="text-center text-sm mt-6 pt-6 border-t border-gray-200">
          <p className="text-gray-700 mb-3">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Log in
            </Link>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
            <Link href="#" className="hover:text-gray-900">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="#" className="hover:text-gray-900">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await form.trigger();
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Reset password
          </h1>
          <p className="text-sm text-gray-600">
            We’ll send a secure reset link to your email address.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="name@clinic.health"
              {...form.register("email")}
            />
          </div>
          <Button className="w-full rounded-2xl" type="submit">
            Send reset link
          </Button>
          <div className="text-center text-sm">
            <Link className="text-primary hover:underline" href="/login">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
