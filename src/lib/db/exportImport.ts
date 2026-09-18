import { db, type AlgoJeetDB, type UserProgress, type UserCode, type Sprint } from './index';

export interface DatabaseBackupPayload {
  formatVersion: 1;
  exportedAt: string;
  app: 'algojeet-pro';
  data: {
    userProgress: UserProgress[];
    userCode: UserCode[];
    sprints: Sprint[];
  };
}

/**
 * Export all reachable IndexedDB data as a JSON string.
 * Never throws away or mutates any records.
 */
export async function exportDatabaseToJson(dbInstance: AlgoJeetDB = db): Promise<string> {
  if (!dbInstance.isOpen()) {
    await dbInstance.open();
  }

  const [userProgress, userCode, sprints] = await Promise.all([
    dbInstance.userProgress.toArray(),
    dbInstance.userCode.toArray(),
    dbInstance.sprints.toArray(),
  ]);

  const payload: DatabaseBackupPayload = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'algojeet-pro',
    data: {
      userProgress,
      userCode,
      sprints,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Trigger a browser download of the exported JSON backup file.
 */
export async function downloadDatabaseBackup(
  filename = `algojeet-backup-${new Date().toISOString().slice(0, 10)}.json`
): Promise<void> {
  const json = await exportDatabaseToJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a JSON backup into IndexedDB without destructive wipes.
 * Uses upsert (put / bulkPut) so existing unconflicting records remain intact.
 */
export async function importDatabaseFromJson(
  jsonString: string,
  dbInstance: AlgoJeetDB = db
): Promise<{ progressCount: number; codeCount: number; sprintCount: number }> {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('Invalid backup file: Payload is empty or not a valid string.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON: Failed to parse backup file.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup format: root must be an object.');
  }

  // Handle both enveloped format and raw tables format
  const data = parsed.data || parsed;
  const userProgress: UserProgress[] = Array.isArray(data.userProgress) ? data.userProgress : [];
  const userCode: UserCode[] = Array.isArray(data.userCode) ? data.userCode : [];
  const sprints: Sprint[] = Array.isArray(data.sprints) ? data.sprints : [];

  if (!dbInstance.isOpen()) {
    await dbInstance.open();
  }

  await dbInstance.transaction('rw', [dbInstance.userProgress, dbInstance.userCode, dbInstance.sprints], async () => {
    if (userProgress.length > 0) {
      await dbInstance.userProgress.bulkPut(userProgress);
    }
    if (userCode.length > 0) {
      await dbInstance.userCode.bulkPut(userCode);
    }
    if (sprints.length > 0) {
      for (const sprint of sprints) {
        // Strip auto-increment ID to prevent collisions on restore
        const { id, ...sprintWithoutId } = sprint;
        await dbInstance.sprints.add(sprintWithoutId as Sprint);
      }
    }
  });

  return {
    progressCount: userProgress.length,
    codeCount: userCode.length,
    sprintCount: sprints.length,
  };
}
