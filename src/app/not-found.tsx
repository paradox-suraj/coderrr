import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">404 — Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        The problem or company page you are looking for does not exist in our algorithmic intelligence catalog.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Cockpit</span>
      </Link>
    </div>
  );
}
