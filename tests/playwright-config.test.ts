import { execSync } from 'child_process';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Playwright Configuration Port Derivation (LOW-02)...');

const configPath = path.resolve(__dirname, '../playwright.config.ts');

// Helper to evaluate config in a subprocess with specific env
function loadConfigWithEnv(env: Record<string, string>) {
  const runnerScript = `
    import rawConfig from '${configPath}';
    const config = (rawConfig as any).default || rawConfig;
    console.log(JSON.stringify({
      baseURL: config.use?.baseURL,
      webServerCommand: config.webServer?.command,
      webServerUrl: config.webServer?.url,
    }));
  `;
  const result = execSync('npx tsx -', {
    input: runnerScript,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  });
  return JSON.parse(result.trim());
}

// 1. When PORT=3457 is set, baseURL, webServerCommand, and webServerUrl MUST reflect port 3457
const customPortConfig = loadConfigWithEnv({ PORT: '3457', BASE_URL: '' });
console.log('Evaluated with PORT=3457:', customPortConfig);

assert(
  customPortConfig.baseURL === 'http://localhost:3457',
  `baseURL must use PORT 3457 (got ${customPortConfig.baseURL})`
);
assert(
  customPortConfig.webServerUrl === 'http://localhost:3457',
  `webServer.url must use PORT 3457 (got ${customPortConfig.webServerUrl})`
);
assert(
  Boolean(customPortConfig.webServerCommand && (customPortConfig.webServerCommand.includes('-p 3457') || customPortConfig.webServerCommand.includes('--port 3457'))),
  `webServer.command must pass -p 3457 to dev server (got ${customPortConfig.webServerCommand})`
);

// 2. When PORT is unset, defaults to 3000
const defaultConfig = loadConfigWithEnv({ PORT: '', BASE_URL: '' });
assert(
  defaultConfig.baseURL === 'http://localhost:3000',
  `default baseURL must be port 3000 (got ${defaultConfig.baseURL})`
);
assert(
  defaultConfig.webServerUrl === 'http://localhost:3000',
  `default webServer.url must be port 3000 (got ${defaultConfig.webServerUrl})`
);

console.log('🎉 All Playwright port configuration tests passed!');
