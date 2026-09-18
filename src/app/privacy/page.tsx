import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy & Data Notice — AlgoJeet Pro',
  description: 'What data AlgoJeet Pro collects, how it is stored, and what our interview simulation mode does (and does not) capture.',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Privacy &amp; Data Notice</h1>
      <p className="text-muted-foreground text-sm mb-10">
        Last updated: September 2026
      </p>

      <Section title="What This App Does">
        <p>
          AlgoJeet Pro is a local-first algorithmic interview preparation platform. Most features —
          including code editing, Python/JavaScript execution, spaced-repetition scheduling, and
          progress tracking — work entirely in your browser with no server communication.
        </p>
      </Section>

      <Section title="Interview Simulation Mode">
        <p>
          When you enable <strong>Interview Simulation Mode</strong> (the shield icon in the timer
          widget), the app provides optional practice tools to simulate proctored coding assessments:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3">
          <li>
            <strong>Focus switch tracking</strong> — logs when you switch to another browser tab or
            minimize the window. A 750ms grace period filters out momentary OS notifications or
            window manager workspace changes.
          </li>
          <li>
            <strong>Optional paste restriction</strong> — an explicit opt-in setting that simulates
            environments like HackerRank or CodeSignal by disabling paste and copy shortcuts so you
            can practice writing solutions from scratch. This is disabled by default to respect
            accessibility and personal workflows.
          </li>
        </ul>
        <p className="mt-4 font-semibold">
          ⚠️ None of this data ever leaves your browser.
        </p>
        <p className="mt-2">
          The focus switch counter is stored only in ephemeral React component state. It is reset when you
          navigate away or reload the page. It is never sent to any server, logged, or associated
          with your account.
        </p>
        <p className="mt-2">
          Interview Simulation Mode is <strong>opt-in</strong> and only activates when the timer is
          running. You can disable it at any time via the shield toggle in the timer widget.
        </p>
      </Section>

      <Section title="Data We Store on the Server">
        <p>
          If you sign in with Clerk, the following data is synced to our Supabase Postgres
          database for cross-device access:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3">
          <li>
            <strong>Problem progress</strong> — which problems you&apos;ve solved or attempted, your
            spaced-repetition ease factor and next review date.
          </li>
          <li>
            <strong>Code buffers</strong> — your last-saved code for each problem and language.
          </li>
          <li>
            <strong>Sprint sessions</strong> — date, duration, and problem IDs of completed sprints.
          </li>
        </ul>
        <p className="mt-4">
          This data is keyed to your Clerk user ID. It is accessible only to your own account via
          Row Level Security on Supabase. We do not sell or share it with third parties.
        </p>
      </Section>

      <Section title="Code Execution">
        <p>
          Python and JavaScript code executes entirely in your browser via WebAssembly (Pyodide)
          and Web Workers. Your code never reaches our servers.
        </p>
        <p className="mt-2">
          C++ and Java code is sent to our server at <code>/api/execute</code>, which forwards it
          to the Piston sandbox API (a third-party open-source code runner). Your code is
          transmitted over HTTPS, executed in an isolated container, and the result is returned.
          We do not log or store submitted code.
        </p>
      </Section>

      <Section title="Clerk Authentication">
        <p>
          Authentication is handled by{' '}
          <a
            href="https://clerk.com/privacy"
            className="underline text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Clerk
          </a>
          . Clerk manages your email, password (if applicable), and OAuth tokens. Please review
          Clerk&apos;s privacy policy for details on how they handle your identity data.
        </p>
      </Section>

      <Section title="Local Storage">
        <p>
          The app uses IndexedDB (via Dexie.js) to persist your progress, code, and notes locally
          in your browser. This storage stays on your device unless you sign in and trigger a sync.
          You can clear it at any time via your browser&apos;s developer tools or by clearing site data.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          If you have questions about this privacy notice or want to request deletion of your
          server-side data, open an issue on the project repository or contact the maintainer
          directly.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3 border-b border-border pb-2">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}
