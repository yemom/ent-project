import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-extrabold text-blue-500">404</h1>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Page Not Found</h2>
        <p className="mt-2 text-sm text-slate-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
