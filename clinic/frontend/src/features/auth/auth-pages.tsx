'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isServerAwake, subscribeServerStatus, wakeUpServer } from '@/services/api/client';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import { useLogin, useRegister } from '@/hooks/use-auth';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Lock,
  Chrome,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Server,
} from 'lucide-react';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/auth/schemas";
import { forgotPassword, resetPassword, type ForgotPasswordResponse } from "@/services/api/auth";
import { useAuthStore } from '@/store/auth-store';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
            የ፟-mom clinic
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

/**
 * Tracks whether the backend is reachable.
 * `true`  = answered the health ping
 * `false` = still booting (Render cold start) or unreachable
 * `null`  = not checked yet
 */
function useServerStatus() {
  const [awake, setAwake] = useState<boolean | null>(() => isServerAwake());

  useEffect(() => {
    setAwake(isServerAwake());
    void wakeUpServer();
    // `subscribeServerStatus` returns a Set.delete, which is a boolean; wrap it
    // so React sees a proper cleanup function.
    const unsubscribe = subscribeServerStatus(setAwake);
    return () => {
      unsubscribe();
    };
  }, []);

  return awake;
}

export function LoginPage() {
  const login = useLogin();
  const [userType, setUserType] = useState<"staff" | "patient">("staff");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const serverAwake = useServerStatus();

  // Set by `/reset-password` once a reset has been redeemed, so the user lands
  // here with the fact that their password changed rather than on a blank form.
  const didReset = useSearchParams().get('reset') === '1';

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = await form.trigger();
    if (isValid) {
      login.mutate(form.getValues());
    }
  };

  // Surface "still booting" as a distinct, friendly state instead of a raw
  // `timeout of 60000ms exceeded`.
  const loginFailedWithWakeUp = login.isError && serverAwake === false;
  const isWakingUp = login.isPending && serverAwake === false;

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            የ፟-mom clinic
          </h1>
          <p className="text-sm text-gray-600">
            Secure access to your high-performance healthcare suite.
          </p>
        </div>

        {/* Tabs */}
        {/* <div className="flex gap-4 mb-6 border-b border-gray-200">
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
        </div> */}

        {didReset ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Your password has been changed</p>
              <p className="text-xs text-teal-800">
                Any other sessions have been signed out. Sign in with your new password.
              </p>
            </div>
          </div>
        ) : null}

        {serverAwake === false ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <Server className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Can’t reach the clinic server</p>
              <p className="text-xs text-amber-700">
                The API health check failed. Check that Docker is running and that
                this device can reach the computer hosting the clinic API, then retry.
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold underline"
                onClick={() => void wakeUpServer()}
              >
                Retry connection
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {login.error ? (
            // role="alert" so assistive technology announces the failure as soon as it
            // appears, rather than leaving a rejected sign-in silently on screen.
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {loginFailedWithWakeUp
                ? "The server is taking longer than usual to start. Please wait a moment and try again."
                : getFriendlyErrorMessage(
                    login.error,
                    "Unable to sign in. Please check your email and password.",
                  )}
            </div>
          ) : null}

          {/* Email/Medical ID Field */}
          <div>
            {/* htmlFor/id pair: a wrapping <label> is not exposed as an accessible
                name by every screen reader, and it leaves getByLabel unusable in
                the end-to-end tests. An explicit association works for both. */}
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              {userType === "staff" ? "Email Address" : "Medical ID or Email"}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="dr.smith@clinic.com"
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
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Security Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
            {login.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isWakingUp ? "Server is waking up…" : "Signing in..."}
              </>
            ) : (
              "Sign In →"
            )}
          </Button>

          {loginFailedWithWakeUp ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void wakeUpServer();
                login.reset();
              }}
              className="w-full h-10 rounded-lg"
            >
              <AlertTriangle className="h-4 w-4" />
              Check server status
            </Button>
          ) : null}
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
  const serverAwake = useServerStatus();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", role: signUpAs },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            የ፟-mom clinic
          </h1>
          <p className="text-sm text-gray-600">Create your account</p>
          <p className="text-xs text-gray-600 mt-1">
            Start managing your healthcare journey today.
          </p>
        </div>

        {serverAwake === false ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            Server is waking up, please wait…
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Full Name
            </label>
            <Input
              placeholder=" Julian Smith"
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
              placeholder="julian.smith@gmail.com"
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
            <div className=" grid  gap-3">
              {/* <button
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
              </button> */}
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

/**
 * Password recovery — step 1: ask for a reset link.
 *
 * <p>Posts to the real `POST /auth/forgot-password`. The server answers the same
 * way for every address, so this screen never knows whether the account exists and
 * must not imply it does either way.
 *
 * <p>There is one honest branch to render: a deployment with no mail transport.
 * The server refuses those requests rather than pretending to send mail, and the
 * user is told to contact the clinic. That is a statement about the deployment,
 * not about the address they typed.
 */
export function ForgotPasswordPage() {
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' }
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const isValid = await form.trigger();
    if (!isValid) return;

    setIsPending(true);
    try {
      setResult(await forgotPassword(form.getValues()));
    } catch (err) {
      setError(
        getFriendlyErrorMessage(
          err,
          'We could not send the reset email. Please try again in a moment.'
        )
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgotten password</h2>
          <p className="text-sm text-gray-600">
            Enter the email address you sign in with and we will send you a link to
            choose a new password.
          </p>
        </div>

        {result ? (
          // role="status" so the outcome is announced rather than appearing silently.
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-4 py-4 text-sm ${
              result.emailSent
                ? 'border-teal-200 bg-teal-50 text-teal-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <p className="font-medium">{result.emailSent ? 'Check your inbox' : 'Contact the clinic'}</p>
            <p className="mt-1">{result.message}</p>
            {!result.emailSent ? (
              <p className="mt-2 text-xs">
                A member of staff can verify your identity and reset the password with
                you in person.
              </p>
            ) : (
              <p className="mt-2 text-xs">
                The link expires in 30 minutes and can be used once. If it does not
                arrive, check your spam folder before asking the clinic for help.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="forgot-email"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden />
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(form.formState.errors.email)}
                  aria-describedby={
                    form.formState.errors.email ? 'forgot-email-error' : undefined
                  }
                  className="pl-10 h-11 border-gray-300 rounded-lg"
                  {...form.register('email')}
                />
              </div>
              {form.formState.errors.email ? (
                <p id="forgot-email-error" className="mt-1 text-xs text-red-600">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-teal-600 hover:text-teal-700 font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

/**
 * Password recovery — step 2: choose a new password.
 *
 * <p>The token arrives in the query string of the emailed link and is read with
 * `useSearchParams`. It is held in component state, submitted once, and never
 * written to storage or to the URL by this screen.
 *
 * <p>Because the server invalidates every session for the account on success, the
 * local session is discarded as well — a user who had this browser signed in to the
 * old password must not keep a token minted before the change.
 */
export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const clearSession = useAuthStore((s) => s.clearSession);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const isValid = await form.trigger();
    if (!isValid) return;

    setIsPending(true);
    try {
      await resetPassword({ token, newPassword: form.getValues('newPassword') });
      // Every session for this account was revoked server-side; drop the local one
      // so this tab cannot continue on the old credentials.
      clearSession();
      setIsDone(true);
      router.push('/login?reset=1');
    } catch (err) {
      setError(
        getFriendlyErrorMessage(
          err,
          'This reset link is invalid or has expired. Request a new one to continue.'
        )
      );
    } finally {
      setIsPending(false);
    }
  };

  // A link opened without its token, or with an empty one, cannot be redeemed.
  if (!token) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">This link is incomplete</h2>
          <p className="mt-2 text-sm text-gray-600">
            The reset link is missing its security token. Open the link straight from
            your email, or request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block font-medium text-teal-700 hover:text-teal-800"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (isDone) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-teal-600" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Password changed</h2>
          <p className="mt-2 text-sm text-gray-600">
            You can now sign in with your new password. Any other sessions have been
            signed out.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a new password</h2>
          <p className="text-sm text-gray-600">
            Your new password takes effect immediately and signs you out everywhere
            else.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="reset-password"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden />
              <Input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 8 chars, letter, number & symbol"
                aria-invalid={Boolean(form.formState.errors.newPassword)}
                aria-describedby={
                  form.formState.errors.newPassword ? 'reset-password-error' : undefined
                }
                className="pl-10 pr-10 h-11 border-gray-300 rounded-lg"
                {...form.register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
            {form.formState.errors.newPassword ? (
              <p id="reset-password-error" className="mt-1 text-xs text-red-600">
                {form.formState.errors.newPassword.message}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              At least 8 characters, including a letter, a number and a special
              character.
            </p>
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden />
              <Input
                id="reset-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                aria-describedby={
                  form.formState.errors.confirmPassword
                    ? 'reset-confirm-password-error'
                    : undefined
                }
                className="pl-10 h-11 border-gray-300 rounded-lg"
                {...form.register('confirmPassword')}
              />
            </div>
            {form.formState.errors.confirmPassword ? (
              <p id="reset-confirm-password-error" className="mt-1 text-xs text-red-600">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Change password'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-teal-600 hover:text-teal-700 font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
