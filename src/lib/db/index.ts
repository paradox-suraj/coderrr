import { Dexie, type EntityTable } from 'dexie';
import { broadcastTabMessage, emergencyQuarantine } from './coordination';

export * from './exportImport';
export * from './coordination';

export type ProblemStatus = 'unsolved' | 'attempted' | 'solved';
export type SupportedLanguage = 'python' | 'cpp' | 'java' | 'javascript';

export interface UserProgress {
  problemId: string;
  status: ProblemStatus;
  revisions: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewDate: string; // ISO String YYYY-MM-DDTHH:mm:ss.sssZ
  lastSolved?: string;
}

export interface UserCode {
  id?: string; // Composite key: `${problemId}_${language}`
  problemId: string;
  language: SupportedLanguage;
  code: string;
  notes?: string;
  updatedAt: string;
}

export interface Sprint {
  id?: number;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  completedCount: number;
  problemIds: string[];
}

export class AlgoJeetDB extends Dexie {
  userProgress!: EntityTable<UserProgress, 'problemId'>;
  userCode!: EntityTable<UserCode, 'id'>;
  sprints!: EntityTable<Sprint, 'id'>;

  constructor() {
    super('AlgoJeetDB');
    this.version(1).stores({
      userProgress: '&problemId, status, nextReviewDate, lastSolved',
      userCode: '&problemId',
      sprints: '++id, date',
    });

    // Version 2: Drop old userCode (having &problemId primary key) and migrate records to tempUserCode (&id)
    // IndexedDB does not allow altering primary keys in-place on existing object stores.
    this.version(2)
      .stores({
        userCode: null,
        tempUserCode: '&id, problemId, language',
      })
      .upgrade(async (tx) => {
        try {
          const oldRecords = await tx.table('userCode').toArray();
          for (const record of oldRecords) {
            const lang = record.language || 'python';
            await tx.table('tempUserCode').add({
              id: record.id || `${record.problemId}_${lang}`,
              problemId: record.problemId,
              language: lang,
              code: record.code,
              notes: record.notes,
              updatedAt: record.updatedAt || new Date().toISOString(),
            });
          }
        } catch {
          // Table may already be dropped or empty
        }
      });

    // Version 3: Recreate userCode with the new composite primary key `&id` and copy back from tempUserCode
    this.version(3)
      .stores({
        tempUserCode: null,
        userCode: '&id, problemId, language',
      })
      .upgrade(async (tx) => {
        try {
          const tempRecords = await tx.table('tempUserCode').toArray();
          for (const record of tempRecords) {
            await tx.table('userCode').add(record);
          }
        } catch {
          // Temp table may already be cleared
        }
      });

    // Multi-tab coordination listeners: unblock migrations without destructive resets
    this.on('versionchange', () => {
      console.warn('[db] Another tab requested a version change. Closing connection to avoid blocking.');
      this.close();
      broadcastTabMessage('DB_VERSION_CHANGE', { reason: 'versionchange' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('algojeet:db-versionchange'));
      }
    });

    this.on('blocked', () => {
      console.warn('[db] Database upgrade blocked by another open tab. Please close other open tabs.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('algojeet:db-blocked'));
      }
    });
  }
}

export const db = new AlgoJeetDB();

const MAX_REOPEN_RETRIES = 3;

/**
 * Ensure database is open with bounded retry and specialized error handling.
 * NEVER deletes user data as an error-recovery strategy.
 */
export async function ensureDbReady(): Promise<AlgoJeetDB> {
  if (db.isOpen()) {
    return db;
  }

  let attempt = 0;
  while (attempt < MAX_REOPEN_RETRIES) {
    try {
      await db.open();
      return db;
    } catch (err: any) {
      attempt++;
      console.warn(`[db] ensureDbReady open attempt ${attempt} failed with ${err?.name || 'Error'}:`, err?.message);

      if (err?.name === 'DatabaseClosedError') {
        // Transient closure from tab transition or idle unload: retry with exponential backoff
        if (attempt < MAX_REOPEN_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 50));
          continue;
        }
      } else if (err?.name === 'VersionError') {
        // Another tab is running a newer schema version: prompt user to reload without touching data
        console.warn('[db] VersionError: Another tab has upgraded the schema. Please reload this tab.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('algojeet:db-version-mismatch'));
        }
        return db;
      } else if (err?.name === 'BlockedError') {
        // Another tab holds an older lock: prompt user to close other tabs
        console.warn('[db] BlockedError: Another tab is holding an older database version open.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('algojeet:db-blocked'));
        }
        return db;
      } else if (err?.name === 'UpgradeError') {
        // Genuine schema issue: quarantine and backup data, NEVER delete
        console.error('[db] UpgradeError: Schema migration issue encountered. Quarantining data safely.');
        await emergencyQuarantine(err);
        return db;
      }

      if (attempt >= MAX_REOPEN_RETRIES) {
        console.error('[db] Failed to open database after retries without deleting data:', err);
        return db;
      }
    }
  }

  return db;
}

// Helper Queries & Mutation Functions
export async function getProblemProgress(problemId: string): Promise<UserProgress | undefined> {
  await ensureDbReady();
  return await db.userProgress.get(problemId);
}

export async function upsertProblemProgress(progress: UserProgress): Promise<string> {
  await ensureDbReady();
  return await db.userProgress.put(progress);
}

export async function getAllSolvedProblemIds(): Promise<Set<string>> {
  await ensureDbReady();
  const records = await db.userProgress.where('status').equals('solved').toArray();
  return new Set(records.map((r) => r.problemId));
}

/**
 * Validates that a code string syntactically matches the target programming language.
 * Prevents cross-language contamination when switching tabs or recovering legacy drafts.
 */
export function isCodeValidForLanguage(code: string, language: SupportedLanguage): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (!trimmed) return false;

  if (language === 'javascript') {
    // Rejects Python syntax in JS buffers
    if (
      trimmed.startsWith('# Problem') ||
      trimmed.includes('(Pyodide WebAssembly)') ||
      /\bdef\s+\w+\s*\(/.test(trimmed) ||
      trimmed.includes('from typing import') ||
      trimmed.includes('import sys')
    ) {
      return false;
    }
    // Rejects C++ or Java syntax
    if (trimmed.includes('using namespace std') || trimmed.includes('public class Main')) {
      return false;
    }
  } else if (language === 'cpp') {
    // Rejects Python syntax in C++ buffers
    if (
      trimmed.startsWith('# Problem') ||
      trimmed.includes('(Pyodide WebAssembly)') ||
      /\bdef\s+\w+\s*\(/.test(trimmed) ||
      trimmed.includes('from typing import')
    ) {
      return false;
    }
    // Rejects Java syntax
    if (trimmed.includes('public class Main') || trimmed.includes('System.out.println')) {
      return false;
    }
  } else if (language === 'java') {
    // Rejects Python syntax in Java buffers
    if (
      trimmed.startsWith('# Problem') ||
      trimmed.includes('(Pyodide WebAssembly)') ||
      /\bdef\s+\w+\s*\(/.test(trimmed) ||
      trimmed.includes('from typing import')
    ) {
      return false;
    }
    // Rejects C++ syntax
    if (trimmed.includes('using namespace std')) {
      return false;
    }
  } else if (language === 'python') {
    // Rejects JS / C++ / Java syntax in Python buffers
    if (
      trimmed.startsWith('//') ||
      trimmed.includes('console.log') ||
      trimmed.includes('public class') ||
      trimmed.includes('using namespace std')
    ) {
      return false;
    }
  }

  return true;
}

export async function getProblemCode(
  problemId: string,
  language: SupportedLanguage = 'python'
): Promise<UserCode | undefined> {
  await ensureDbReady();
  const compositeId = `${problemId}_${language}`;
  const record = await db.userCode.get(compositeId);

  if (record && record.code) {
    if (isCodeValidForLanguage(record.code, language)) {
      return record;
    }
    // Delete contaminated record from Dexie
    try {
      await db.userCode.delete(compositeId);
    } catch {
      // Ignore
    }
  }

  // Fallback check for legacy record strictly if its language matches or is legacy default for python
  const legacyRecord = await db.userCode.where('problemId').equals(problemId).first();
  if (
    legacyRecord &&
    legacyRecord.code &&
    (legacyRecord.language === language || (!legacyRecord.language && language === 'python')) &&
    isCodeValidForLanguage(legacyRecord.code, language)
  ) {
    return legacyRecord;
  }

  return undefined;
}

export async function saveProblemCode(
  problemId: string,
  code: string,
  language: SupportedLanguage = 'python',
  notes?: string
): Promise<string> {
  await ensureDbReady();
  const compositeId = `${problemId}_${language}`;
  const key = await db.userCode.put({
    id: compositeId,
    problemId,
    language,
    code,
    notes,
    updatedAt: new Date().toISOString(),
  });
  return String(key);
}

export async function getProblemNotes(problemId: string): Promise<string> {
  await ensureDbReady();
  // Notes are shared across languages for the same problem
  const records = await db.userCode.where('problemId').equals(problemId).toArray();
  const withNotes = records.find((r) => r.notes && r.notes.trim().length > 0);
  return withNotes?.notes || '';
}

export async function getDueReviews(targetDate = new Date()): Promise<UserProgress[]> {
  await ensureDbReady();
  const targetIso = targetDate.toISOString();
  return await db.userProgress
    .where('nextReviewDate')
    .belowOrEqual(targetIso)
    .toArray();
}

export async function logSprintCompletion(sprint: Omit<Sprint, 'id'>): Promise<number> {
  await ensureDbReady();
  const key = await db.sprints.add(sprint);
  return Number(key);
}

