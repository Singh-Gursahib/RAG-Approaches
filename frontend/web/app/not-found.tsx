import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-display text-[80px] tracking-tightest text-ink">
        Lost in the corpus.
      </h1>
      <p className="mt-4 text-ink-muted">That page isn&apos;t in our context.</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 bg-ink text-canvas px-5 py-3 rounded-full text-[14px] hover:bg-ink/90 transition-colors"
      >
        Back to overview
      </Link>
    </div>
  );
}
