import type { Metadata } from 'next';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import Sidebar from '@/components/navigation/Sidebar';
import CommandPalette from '@/components/dashboard/CommandPalette';
import GridPattern from '@/components/canvas/GridPattern';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'AlgoJeet Pro — Technical Interview Preparation Platform',
  description: 'Practice 3,350+ curated LeetCode problems with company frequency rankings, in-browser code execution, and spaced repetition.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen flex flex-col md:flex-row selection:bg-primary/30 selection:text-primary-foreground relative"
      >
        <ClerkProvider>
          {/* Haikei Mesh Wave Artwork */}
          <div className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[url('/backgrounds/hero-mesh.svg')] bg-cover bg-center" />
          
          {/* 32px Center-Masked Dot Grid Pattern */}
          <GridPattern className="opacity-25 z-0" />

          <Sidebar />
          <main className="flex-1 min-w-0 flex flex-col relative z-10 overflow-x-hidden min-h-screen">
            {children}
          </main>
          <CommandPalette />
          <ServiceWorkerRegister />
        </ClerkProvider>
      </body>
    </html>
  );
}

