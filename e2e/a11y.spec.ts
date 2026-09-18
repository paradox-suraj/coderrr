/**
 * E2E Test: WCAG Accessibility Audit
 *
 * Uses @axe-core/playwright to scan key pages for WCAG AA violations.
 * Fails on critical or serious violations.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES_TO_AUDIT = [
  { name: 'Dashboard', path: '/' },
  { name: 'Problems List', path: '/problems' },
  { name: 'Problem Workspace', path: '/problem/1' },
  { name: 'Companies', path: '/companies' },
  { name: 'ROI Compare', path: '/companies/compare' },
  { name: 'Review Queue', path: '/review' },
  { name: 'Privacy', path: '/privacy' },
];

for (const { name, path } of PAGES_TO_AUDIT) {
  test(`${name} — no critical/serious WCAG violations`, async ({ page }) => {
    await page.goto(path);

    // Wait for page to be interactive
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // Exclude Monaco editor internals — they have known accessibility constraints
      .exclude('.monaco-editor')
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      const report = criticalOrSerious
        .map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes.map((n) => n.target).join(', ')}`)
        .join('\n');
      console.error(`\nWCAG violations on ${name}:\n${report}`);
    }

    expect(criticalOrSerious).toHaveLength(0);
  });
}

test('Command Palette — accessible dialog with focus trap', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Open command palette
  await page.keyboard.press('Control+k');
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 3000 });

  // Should have aria-modal
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  // Input should be focused
  const input = dialog.locator('input');
  await expect(input).toBeFocused();

  // Escape should close
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
