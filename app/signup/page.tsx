import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { GoogleAuthButton, OrDivider } from "@/components/GoogleAuthButton";
import { BrandLogo } from "@/components/BrandLogo";

interface Props {
  searchParams: { error?: string };
}

export default function SignupPage({ searchParams }: Props) {
  const error = searchParams.error;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-gray-100 shadow-sm">
        {/* Logo */}
        <Link href="/" className="inline-block mb-8">
          <BrandLogo />
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
        <p className="text-gray-500 text-sm mb-6">
          Start converting more trial users to paid — free to get started.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 rounded-md text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <GoogleAuthButton label="Sign up with Google" />
        <OrDivider />

        <form action={signUp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Create account
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            By signing up you agree to our{" "}
            <span className="text-gray-500">Terms of Service</span> and{" "}
            <span className="text-gray-500">Privacy Policy</span>.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
