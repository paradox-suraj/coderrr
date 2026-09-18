/**
 * E2E Test: Python (Pyodide WASM) solve flow
 *
 * Flow: Open problem #1 (Two Sum) → select Python → write correct solution
 *       → submit → assert Accepted banner → assert SM-2 state updated
 */
import { test, expect } from '@playwright/test';

const TWO_SUM_SOLUTION = `
from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            complement = target - n
            if complement in seen:
                return [seen[complement], i]
            seen[n] = i
        return []
`.trim();

test.describe('Python Pyodide Solve Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB state before each test for isolation
    await page.addInitScript(() => {
      indexedDB.deleteDatabase('AlgoJeetDB');
    });
    await page.goto('/problem/1');
    // Wait for Pyodide to finish loading (may take up to 30s on cold start)
    await page.waitForFunction(
      () => !document.body.innerText.includes('Initializing Monaco'),
      { timeout: 30_000 }
    );
  });

  test('should show problem title and difficulty', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Two Sum' })).toBeVisible();
    await expect(page.locator('span:text("Easy")')).toBeVisible();
  });

  async function setPythonSolutionCode(p: any, code: string) {
    await p.waitForFunction(() => {
      const monaco = (window as any).monaco;
      const models = monaco?.editor?.getModels?.();
      return models && models.length > 0;
    }, { timeout: 20_000 });

    await p.evaluate((c: string) => {
      const monaco = (window as any).monaco;
      const models = monaco.editor.getModels();
      const model = models.find((m: any) => m.getLanguageId() === 'python') || models[0];
      model.setValue(c);
    }, code);
  }

  test('should accept a correct Python solution', async ({ page }) => {
    // Ensure Python is selected
    await expect(page.getByRole('button', { name: /Python 3/i }).first()).toBeVisible();

    // Wait for Pyodide to be ready (badge: "WASM (Client)" or "Pyodide Ready")
    await page.waitForFunction(
      () => document.body.innerText.includes('WASM') || document.body.innerText.includes('Ready'),
      { timeout: 45_000 }
    );

    // Set solution code cleanly
    await setPythonSolutionCode(page, TWO_SUM_SOLUTION);

    // Submit
    await page.getByRole('button', { name: /Submit/i }).first().click();

    // Wait for submission result (up to 30 seconds for Pyodide execution)
    await expect(page.getByText('Accepted').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/test cases passed/i).first()).toBeVisible();
  });

  test('should update SM-2 schedule after accepted submission', async ({ page }) => {
    await page.waitForFunction(
      () => document.body.innerText.includes('WASM') || document.body.innerText.includes('Ready'),
      { timeout: 45_000 }
    );

    await setPythonSolutionCode(page, TWO_SUM_SOLUTION);
    await page.getByRole('button', { name: /Submit/i }).first().click();
    await expect(page.getByText('Accepted').first()).toBeVisible({ timeout: 30_000 });

    // SM-2 rating section should be visible after solve
    await expect(page.getByText(/SM-2 Spaced Recall Rating/i)).toBeVisible();
    // Next review date should be populated
    await expect(page.getByText(/Next:/i)).toBeVisible();
  });

  test('should show Review Queue after solve', async ({ page }) => {
    await page.waitForFunction(
      () => document.body.innerText.includes('WASM') || document.body.innerText.includes('Ready'),
      { timeout: 45_000 }
    );

    await setPythonSolutionCode(page, TWO_SUM_SOLUTION);
    await page.getByRole('button', { name: /Submit/i }).first().click();
    await expect(page.getByText('Accepted').first()).toBeVisible({ timeout: 30_000 });

    // Navigate to review
    await page.goto('/review');
    // After a first solve, SM-2 sets next review in 1 day — so not due today
    // But the page should render without error
    await expect(page.getByRole('heading', { name: /All caught up/i })).toBeVisible();
  });
});
