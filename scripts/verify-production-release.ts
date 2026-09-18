import { spawn } from 'node:child_process';
import http from 'node:http';

// Ensure all loopback connections bypass any environment proxies
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
delete process.env.HTTPS_PROXY;
delete process.env.https_proxy;
process.env.NO_PROXY = '*';
process.env.no_proxy = '*';

const PORT = 39421;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const routes = [
  '/',
  '/problems',
  '/companies',
  '/companies/compare',
  '/privacy',
  '/problem/136',
  '/profile',
  '/review',
  '/api/health',
  '/api/health/execution',
  '/api/companies/compare?companies=google,amazon',
  '/pyodide/pyodide.js',
  '/monaco/vs/loader.js',
];

function fetchRoute(path: string): Promise<{ status: number; bytes: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        headers: { Host: `127.0.0.1:${PORT}` },
      },
      (res) => {
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, bytes: size });
        });
      }
    );
    req.on('error', reject);
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`🚀 Starting production server on 127.0.0.1:${PORT}...`);
  const cleanEnv: Record<string, string | undefined> = { ...process.env };
  delete cleanEnv.HTTP_PROXY;
  delete cleanEnv.http_proxy;
  delete cleanEnv.HTTPS_PROXY;
  delete cleanEnv.https_proxy;
  cleanEnv.PORT = String(PORT);
  cleanEnv.NO_PROXY = '*';
  cleanEnv.no_proxy = '*';

  const server = spawn('pnpm', ['next', 'start', '-H', '0.0.0.0', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: cleanEnv as NodeJS.ProcessEnv,
  });

  server.stdout?.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Ready') || s.includes('error') || s.includes('Error')) {
      process.stdout.write(`[server] ${s}`);
    }
  });
  server.stderr?.on('data', (d) => process.stderr.write(`[server err] ${d.toString()}`));

  // Wait for server to boot
  let ready = false;
  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(500);
    try {
      const res = await fetchRoute('/api/health');
      if (res.status === 200) {
        ready = true;
        console.log(`✅ Server ready after ${attempt * 500}ms`);
        break;
      }
    } catch {
      // connecting...
    }
  }

  if (!ready) {
    console.error('❌ Server failed to boot within 15 seconds.');
    server.kill('SIGTERM');
    process.exit(1);
  }

  console.log('\n--- Step 3: Verifying all production routes (HTTP 200 OK) ---');
  let allPass = true;
  for (const route of routes) {
    try {
      const res = await fetchRoute(route);
      const pass = res.status === 200;
      console.log(
        `${pass ? '✅' : '❌'} ${route.padEnd(25)} -> HTTP ${res.status} (${res.bytes.toLocaleString()} bytes)`
      );
      if (!pass) allPass = false;
    } catch (err) {
      console.error(`❌ ${route.padEnd(25)} -> Failed to connect:`, err);
      allPass = false;
    }
  }

  if (!allPass) {
    server.kill('SIGTERM');
    process.exit(1);
  }

  console.log('\n--- Step 6: 60-Second Soak Test (Simulated Load & Memory Stability) ---');
  const startTime = Date.now();
  const soakDurationMs = 60_000;
  let totalRequests = 0;
  let errorCount = 0;

  console.log(`Pounding production server with simulated load for 60 seconds...`);
  while (Date.now() - startTime < soakDurationMs) {
    const batch = routes.map((r) => fetchRoute(r));
    const results = await Promise.allSettled(batch);
    for (const res of results) {
      totalRequests++;
      if (res.status !== 'fulfilled' || res.value.status !== 200) {
        errorCount++;
      }
    }
    await sleep(200); // polite pacing
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nSoak test completed:`);
  console.log(`- Duration: ${durationSec}s`);
  console.log(`- Total requests served: ${totalRequests}`);
  console.log(`- Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.error(`❌ Soak test experienced ${errorCount} errors.`);
    server.kill('SIGTERM');
    process.exit(1);
  }

  console.log('✅ Zero errors observed under 60-second sustained load.');
  server.kill('SIGTERM');
  console.log('🎉 Production server verified and cleanly shut down.');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
