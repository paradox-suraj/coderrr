/**
 * Browser Storage Persistence & Eviction Shield
 *
 * In WebKit / Safari (macOS, iOS, iPadOS), Apple's Intelligent Tracking Prevention (ITP)
 * evicts all IndexedDB and local storage after 7 days without user activity unless
 * persistent storage permission is explicitly granted via navigator.storage.persist().
 */

export interface StorageStatus {
  isSupported: boolean;
  isPersisted: boolean;
  usageMb?: number;
  quotaMb?: number;
}

export async function checkStoragePersistence(): Promise<StorageStatus> {
  if (typeof window === "undefined" || !("storage" in navigator) || !(navigator as any).storage) {
    return {
      isSupported: false,
      isPersisted: false,
    };
  }

  try {
    const storage = (navigator as any).storage;
    const isPersisted = storage.persisted ? await storage.persisted() : false;

    let usageMb: number | undefined = undefined;
    let quotaMb: number | undefined = undefined;

    if (storage.estimate) {
      const estimate = await storage.estimate();
      if (typeof estimate.usage === "number") {
        usageMb = Math.round((estimate.usage / (1024 * 1024)) * 10) / 10;
      }
      if (typeof estimate.quota === "number") {
        quotaMb = Math.round((estimate.quota / (1024 * 1024)) * 10) / 10;
      }
    }

    return {
      isSupported: true,
      isPersisted,
      usageMb,
      quotaMb,
    };
  } catch (err) {
    console.warn("[StoragePersistence] Check failed:", err);
    return {
      isSupported: true,
      isPersisted: false,
    };
  }
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof window === "undefined" || !("storage" in navigator) || !(navigator as any).storage?.persist) {
    return false;
  }

  try {
    const isPersisted = await (navigator as any).storage.persist();
    if (isPersisted) {
      console.log("[StoragePersistence] Persistent storage granted by browser.");
    } else {
      console.warn("[StoragePersistence] Persistent storage request denied or not granted.");
    }
    return isPersisted;
  } catch (err) {
    console.error("[StoragePersistence] Request failed:", err);
    return false;
  }
}
