import Link from "next/link";
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl mb-4">🃏</div>
      <h2 className="font-display text-2xl font-bold text-white mb-2">Card Not Found</h2>
      <p className="text-neutral mb-6">This page doesn't exist or the card was removed.</p>
      <Link href="/" className="text-gold hover:text-gold-light font-mono text-sm transition-colors">
        ← Return home
      </Link>
    </div>
  );
}
