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
    await expect(page.getByText('Two Sum')).toBeVisible();
    await expect(page.locator('span:text("Easy")')).toBeVisible();
  });

  test('should accept a correct Python solution', async ({ page }) => {
    // Ensure Python is selected
    await expect(page.getByText('Python 3')).toBeVisible();

    // Type solution into Monaco editor
    // Monaco renders into a contenteditable div
    const editor = page.locator('.monaco-editor .inputarea');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(TWO_SUM_SOLUTION);

    // Wait for Pyodide to be ready (badge: "WASM (Client)")
    await page.waitForFunction(
      () => document.body.innerText.includes('WASM') || document.body.innerText.includes('Ready'),
      { timeout: 45_000 }
    );

    // Submit
    await page.getByRole('button', { name: /Submit/i }).click();

    // Wait for submission result (up to 30 seconds for Pyodide execution)
    await expect(page.getByText('Accepted')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/All test cases passed/i)).toBeVisible();
  });

  test('should update SM-2 schedule after accepted submission', async ({ page }) => {
    const editor = page.locator('.monaco-editor .inputarea');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(TWO_SUM_SOLUTION);

    await page.waitForFunction(
      () => document.body.innerText.includes('WASM') || document.body.innerText.includes('Ready'),
      { timeout: 45_000 }
    );
    await page.getByRole('button', { name: /Submit/i }).click();
    await expect(page.getByText('Accepted')).toBeVisible({ timeout: 30_000 });

    // SM-2 rating section should be visible after solve
    await expect(page.getByText(/SM-2 Spaced Recall Rating/i)).toBeVisible();
    // Next review date should be populated
    await expect(page.getByText(/Next:/i)).toBeVisible();
  });

  test('should show Review Queue after solve', async ({ page }) => {
    const editor = page.locator('.monaco-editor .inputarea');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(TWO_SUM_SOLUTION);

    await page.waitForFunction(
      () => document.body.innerText.includes('WASM') || document.body.innerText.includes('Ready'),
      { timeout: 45_000 }
    );
    await page.getByRole('button', { name: /Submit/i }).click();
    await expect(page.getByText('Accepted')).toBeVisible({ timeout: 30_000 });

    // Navigate to review
    await page.goto('/review');
    // After a first solve, SM-2 sets next review in 1 day — so not due today
    // But the page should render without error
    await expect(page.getByText(/Review Queue|caught up/i)).toBeVisible();
  });
});
