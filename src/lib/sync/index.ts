/**
 * Cross-Device Sync Orchestrator
 *
 * Syncs local Dexie (IndexedDB) state with the server after sign-in,
 * and pushes updates to the server after each solve.
 *
 * Strategy: last-write-wins on `updatedAt` / `lastSolved` timestamps.
 */

import { db, type UserProgress, type UserCode, type Sprint } from '@/lib/db';

export interface ServerSyncPayload {
  userProgress: UserProgress[];
  userCode: UserCode[];
  sprints: Sprint[];
  syncedAt: string;
}

/**
 * Pull server state and merge into local Dexie.
 * Called once on sign-in.
 */
export async function pullAndMerge(userId: string): Promise<void> {
  try {
    const res = await fetch('/api/sync', {
      method: 'GET',
      headers: { 'x-user-id': userId },
    });

    if (!res.ok) {
      console.warn('[sync] Pull failed:', res.status);
      return;
    }

    const server: ServerSyncPayload = await res.json();

    // Merge userProgress: server wins if server.lastSolved is newer
    for (const serverRecord of server.userProgress) {
      const local = await db.userProgress.get(serverRecord.problemId);
      if (!local || (serverRecord.lastSolved && (!local.lastSolved || serverRecord.lastSolved > local.lastSolved))) {
        await db.userProgress.put(serverRecord);
      }
    }

    // Merge userCode: server wins if server.updatedAt is newer
    for (const serverCode of server.userCode) {
      if (!serverCode.id) continue;
      const local = await db.userCode.get(serverCode.id);
      if (!local || serverCode.updatedAt > local.updatedAt) {
        await db.userCode.put(serverCode);
      }
    }

    // Sprints: append server sprints that don't exist locally (by date+duration match)
    const localSprints = await db.sprints.toArray();
    for (const serverSprint of server.sprints) {
      const alreadyExists = localSprints.some(
        (s) => s.date === serverSprint.date && s.durationMinutes === serverSprint.durationMinutes
      );
      if (!alreadyExists) {
        await db.sprints.add({
          date: serverSprint.date,
          durationMinutes: serverSprint.durationMinutes,
          completedCount: serverSprint.completedCount,
          problemIds: serverSprint.problemIds,
        });
      }
    }

    console.log('[sync] Pull complete:', {
      progress: server.userProgress.length,
      code: server.userCode.length,
      sprints: server.sprints.length,
    });
  } catch (err) {
    console.warn('[sync] Pull error (non-fatal):', err);
  }
}

/**
 * Push local Dexie state to the server.
 * Called after each successful solve or on sign-in.
 */
export async function pushToServer(userId: string): Promise<void> {
  try {
    const [userProgress, userCode, sprints] = await Promise.all([
      db.userProgress.toArray(),
      db.userCode.toArray(),
      db.sprints.toArray(),
    ]);

    const payload: ServerSyncPayload = {
      userProgress,
      userCode,
      sprints,
      syncedAt: new Date().toISOString(),
    };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('[sync] Push failed:', res.status);
    } else {
      console.log('[sync] Push complete');
    }
  } catch (err) {
    console.warn('[sync] Push error (non-fatal):', err);
  }
}
