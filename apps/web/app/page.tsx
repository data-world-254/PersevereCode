import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Persevere</h1>
      <p className="mt-4 text-lg text-neutral-600">
        Sign in to connect your GitHub and use the Persevere extension.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Log in
        </Link>
        <Link
          href="/device"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-white"
        >
          Device login
        </Link>
      </div>
    </main>
  );
}
