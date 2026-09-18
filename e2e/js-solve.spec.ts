/**
 * E2E Test: JavaScript (Web Worker) solve flow
 *
 * Flow: Open problem #1 (Two Sum) → select JavaScript → write correct solution
 *       → submit → assert Accepted banner
 */
import { test, expect } from '@playwright/test';

const JS_TWO_SUM = `
class Solution {
    twoSum(nums, target) {
        const seen = {};
        for (let i = 0; i < nums.length; i++) {
            const complement = target - nums[i];
            if (complement in seen) return [seen[complement], i];
            seen[nums[i]] = i;
        }
        return [];
    }
}
const s = new Solution();
`.trim();

test.describe('JavaScript Web Worker Solve Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.deleteDatabase('AlgoJeetDB');
    });
    await page.goto('/problem/1');
    await page.waitForFunction(
      () => !document.body.innerText.includes('Initializing Monaco'),
      { timeout: 30_000 }
    );
  });

  test('should switch to JavaScript and accept a correct solution', async ({ page }) => {
    // Switch to JavaScript
    const langSelector = page.getByRole('button', { name: /Python 3/i }).first();
    await langSelector.click();
    await page.getByRole('button', { name: /JavaScript/i }).first().click();

    // Set solution directly into Monaco editor model
    await page.waitForFunction(() => {
      const monaco = (window as any).monaco;
      const models = monaco?.editor?.getModels?.();
      return models && models.some((m: any) => m.getLanguageId() === 'javascript');
    }, { timeout: 20_000 });

    await page.evaluate((c: string) => {
      const monaco = (window as any).monaco;
      const models = monaco.editor.getModels();
      const jsModel = models.find((m: any) => m.getLanguageId() === 'javascript') || models[models.length - 1];
      jsModel.setValue(c);
    }, JS_TWO_SUM);

    // Submit
    await page.getByRole('button', { name: /Submit/i }).first().click();

    // JS worker is instant — 10s timeout is sufficient
    await expect(page.getByText('Accepted').first()).toBeVisible({ timeout: 10_000 });
  });
});
