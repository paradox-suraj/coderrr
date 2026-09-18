import { NextResponse, type NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';

// Routes that require server-side authentication redirect
const isProtectedRoute = createRouteMatcher([
  // Profile handles signed-out states gracefully via Clerk's <SignedOut> and local IndexedDB controls
]);

export default function middleware(req: NextRequest, event: any) {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }

  return clerkMiddleware(async (auth, request) => {
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  })(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};

