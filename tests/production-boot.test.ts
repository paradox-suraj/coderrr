import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Production Build Routes Manifest Integrity...');

const manifestPath = path.resolve(__dirname, '../.next/routes-manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.log('⚠️  .next/routes-manifest.json not found (build has not run yet). Skipping manifest validation in pre-build stage.');
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log('Current Manifest Keys:', Object.keys(manifest));

assert(Array.isArray(manifest.dataRoutes), `routesManifest.dataRoutes must be an array (got ${typeof manifest.dataRoutes})`);
assert(Array.isArray(manifest.dynamicRoutes), `routesManifest.dynamicRoutes must be an array (got ${typeof manifest.dynamicRoutes})`);
assert(Array.isArray(manifest.staticRoutes), `routesManifest.staticRoutes must be an array (got ${typeof manifest.staticRoutes})`);

console.log('🎉 Production routes manifest is complete and valid!');
