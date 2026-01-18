import { test, expect } from '@playwright/test';

test.describe('Gantt Chart CRUD', () => {
    test.beforeEach(async ({ page }) => {
        // Mock Auth
        await page.context().addInitScript(() => {
            localStorage.setItem('token', 'fake-token');
        });

        // Mock User
        await page.route('**/api/v1/auth/me', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 1,
                    username: "admin",
                    is_admin: true,
                    full_name: "Admin User",
                    auth_source: "db"
                })
            });
        });

        // Mock Projects
        await page.route('**/api/v1/projects', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: 1, name: "Project Alpha", identifier: "alpha" }
                ])
            });
        });

        // Mock Gantt Data
        await page.route('**/api/v1/pm-copilot/projects/1/gantt', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [
                        { id: 1, text: "Task 1", start_date: "2023-01-01", duration: 5, progress: 0.5 }
                    ],
                    links: []
                })
            });
        });

        await page.goto('/ai-planner');
        await page.getByRole('button', { name: '甘特圖' }).click();
    });

    test('should require project selection', async ({ page }) => {
        await expect(page.getByText('請先選擇專案以檢視甘特圖')).toBeVisible();
    });

    test('should load gantt chart after selecting project', async ({ page }) => {
        await page.locator('select').selectOption({ label: 'Project Alpha' });
        await expect(page.locator('.gantt_layout').first()).toBeVisible({ timeout: 10000 });
    });

    test('should display task add button in gantt', async ({ page }) => {
        await page.locator('select').selectOption({ label: 'Project Alpha' });
        await expect(page.locator('.gantt_add')).toBeVisible();
    });
});
