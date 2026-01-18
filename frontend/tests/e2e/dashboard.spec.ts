import { test, expect } from '@playwright/test';

test.describe('Executive Dashboard', () => {
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

        // Mock Dashboard Data
        await page.route('**/api/v1/dashboard/executive-summary', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    portfolio_health: { critical: 2, warning: 5, healthy: 10 },
                    total_projects: 17,
                    project_health_list: [
                        { id: 1, name: "Project A", identifier: "p-a", health_status: "critical", overdue_count: 5 }
                    ],
                    top_risks: [
                        { id: 101, project_name: "Project A", subject: "Critical Task 1", due_date: "2023-12-31", assigned_to: "Alice" }
                    ]
                })
            });
        });

        // Mock AI Briefing
        await page.route('**/api/v1/pm-copilot/executive-briefing', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    markdown_report: "# Executive Briefing\n\nAll systems nominal."
                })
            });
        });
    });

    test('should load dashboard and display KPI cards', async ({ page }) => {
        await page.goto('/executive-dashboard');

        // Check for main title
        await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();

        // Check for KPI Cards
        await expect(page.getByText('Total Projects')).toBeVisible();
        await expect(page.getByText('Critical').first()).toBeVisible();

        // Check Mocked Data
        await expect(page.getByText('17')).toBeVisible(); // Total projects
        // Target specific KPI card for Warning count (5)
        await expect(page.locator('.border-yellow-500').getByText('5')).toBeVisible();
        // Warning text is "Warning" then value "5"
    });

    test('should open AI Briefing modal', async ({ page }) => {
        await page.goto('/executive-dashboard');

        // Click generate button
        await page.getByRole('button', { name: /Generate AI Briefing/i }).click();

        // Check modal opens
        await expect(page.getByText('AI Executive Briefing')).toBeVisible();

        // Check for Generate button inside modal
        await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible(); // Button text changes to Regenerate if loading finishes? 
        // Initial text "Generate Report"? No, code says:
        // {loading ? 'Generating...' : 'Regenerate'}
        // And auto-generates on open. So likely 'Regenerate'.
    });
});
