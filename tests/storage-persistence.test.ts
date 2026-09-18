import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("🧪 Testing Safari Storage Persistence & Eviction Warning (MED-02)...");

// 1. Verify src/lib/storage/persistence.ts exists
const persistenceModulePath = path.resolve(__dirname, "../src/lib/storage/persistence.ts");
assert(fs.existsSync(persistenceModulePath), "src/lib/storage/persistence.ts must exist");

// 2. Import and test functions
import { checkStoragePersistence, requestStoragePersistence } from "../src/lib/storage/persistence";

async function runTests() {
  // Test in Node environment (no navigator.storage) - must not crash
  const nodeCheck = await checkStoragePersistence();
  assert(nodeCheck.isSupported === false, "checkStoragePersistence in non-browser must report isSupported: false");
  assert(nodeCheck.isPersisted === false, "checkStoragePersistence in non-browser must report isPersisted: false");

  const nodeReq = await requestStoragePersistence();
  assert(nodeReq === false, "requestStoragePersistence in non-browser must safely return false");

  // Mock navigator.storage in globalThis
  let persistCalled: boolean = false;
  let isPersistedState: boolean = false;

  Object.defineProperty(globalThis, 'window', {
    value: {},
    configurable: true,
  });

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      storage: {
        persisted: async () => isPersistedState,
        persist: async () => {
          persistCalled = true;
          isPersistedState = true;
          return true;
        },
        estimate: async () => ({
          quota: 1024 * 1024 * 500, // 500 MB
          usage: 1024 * 1024 * 12,  // 12 MB
        }),
      },
    },
    configurable: true,
  });

  const browserCheck = await checkStoragePersistence();
  assert(browserCheck.isSupported === true, "Mocked browser must report isSupported: true");
  assert(browserCheck.isPersisted === false, "Initial mocked state must be unpersisted");
  assert(browserCheck.usageMb === 12, `Usage must be converted to MB (got: ${browserCheck.usageMb})`);

  const reqResult = await requestStoragePersistence();
  assert(Boolean(persistCalled), "requestStoragePersistence must invoke navigator.storage.persist()");
  assert(reqResult === true, "requestStoragePersistence must return true when granted");

  const postCheck = await checkStoragePersistence();
  assert(postCheck.isPersisted === true, "Post-persist check must report isPersisted: true");

  // 3. Verify profile page includes Safari advisory and persistence controls
  const profilePagePath = path.resolve(__dirname, "../src/app/profile/page.tsx");
  const profileContent = fs.readFileSync(profilePagePath, "utf-8");

  assert(
    profileContent.includes("Safari") && profileContent.includes("7 day"),
    "src/app/profile/page.tsx must display Safari / WebKit 7-day storage purge advisory"
  );
  assert(
    profileContent.includes("Persistent Storage") || profileContent.includes("persistent storage"),
    "src/app/profile/page.tsx must display Persistent Storage status"
  );

  console.log("🎉 All Safari storage persistence tests passed!");
}

runTests().catch((err) => {
  console.error("Storage persistence test failed:", err);
  process.exit(1);
});
