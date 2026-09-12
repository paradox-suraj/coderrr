import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/navigation/Sidebar';
import CommandPalette from '@/components/cockpit/CommandPalette';
import GridPattern from '@/components/canvas/GridPattern';

export const metadata: Metadata = {
  title: 'AlgoJeet Pro — Algorithmic Intelligence Platform',
  description: 'High-performance local-first algorithmic prep workbench with WebGL constellation, ADHD focus cockpit, and Pyodide sandbox.',
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
        {/* Haikei Mesh Wave Artwork */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[url('/backgrounds/hero-mesh.svg')] bg-cover bg-center" />
        
        {/* 32px Center-Masked Dot Grid Pattern */}
        <GridPattern className="opacity-25 z-0" />

        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col relative z-10 overflow-x-hidden min-h-screen">
          {children}
        </main>
        <CommandPalette />
      </body>
    </html>
  );
}
