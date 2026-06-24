import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f4f8fc] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="inline-flex items-center gap-2 mb-8">
          <span className="inline-block h-7 w-7 rounded-full bg-gradient-to-br from-[#1557c9] to-[#4d9af5]" />
          <span className="font-bold text-gray-900 text-lg">ConversionCRM</span>
        </div>

        <p className="text-7xl font-extrabold text-[#1557c9] tracking-tight">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          This page could not be found
        </h1>
        <p className="mt-3 text-gray-500 leading-relaxed">
          The link may be broken or the page may have moved. Let&apos;s get you
          back to converting more trials.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-[#1557c9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1149a8] transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-400">
          <Link href="/blog" className="hover:text-gray-600 transition-colors">Blog</Link>
          <Link href="/compare" className="hover:text-gray-600 transition-colors">Compare</Link>
          <Link href="/pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-gray-600 transition-colors">Contact</Link>
        </div>
      </div>
    </main>
  );
}
