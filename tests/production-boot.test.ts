import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Production Build Routes Manifest Integrity (CRIT-01)...');

const manifestPath = path.resolve(__dirname, '../.next/routes-manifest.json');

assert(fs.existsSync(manifestPath), `.next/routes-manifest.json must exist at ${manifestPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log('Current Manifest Keys:', Object.keys(manifest));

assert(Array.isArray(manifest.dataRoutes), `routesManifest.dataRoutes must be an array (got ${typeof manifest.dataRoutes})`);
assert(Array.isArray(manifest.dynamicRoutes), `routesManifest.dynamicRoutes must be an array (got ${typeof manifest.dynamicRoutes})`);
assert(Array.isArray(manifest.staticRoutes), `routesManifest.staticRoutes must be an array (got ${typeof manifest.staticRoutes})`);

console.log('🎉 Production routes manifest is complete and valid!');
