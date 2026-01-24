import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TaskImportModal } from '../TaskImportModal';

// Mock fetch
globalThis.fetch = vi.fn();

const mockProjects = [
    { id: 1, name: 'Main Project', parent_id: null },
    { id: 2, name: 'Sub Project', parent_id: 1 },
    { id: 3, name: 'Other Project', parent_id: null }
];

const mockTasks = [
    {
        id: 101,
        subject: 'Task in Main',
        project_id: 1,
        project_name: 'Main Project',
        status_id: 1,
        status_name: 'New',
        updated_on: '2023-01-01'
    }
];

describe('TaskImportModal', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Default mock implementation for projects
        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/projects')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockProjects)
                });
            }
            if (url.includes('/search')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockTasks)
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('renders project list on open', async () => {
        render(<TaskImportModal isOpen={true} onClose={() => { }} />);

        // Check for "所有專案" (All Projects)
        expect(screen.getByText('所有專案')).toBeInTheDocument();

        // Wait for projects to load
        await waitFor(() => {
            expect(screen.getByText('Main Project')).toBeInTheDocument();
            expect(screen.getByText('Other Project')).toBeInTheDocument();
        });

        // Sub Project might be hidden if Main Project is collapsed? 
        // Logic says default expanded = true in ProjectItem.
        expect(screen.getByText('Sub Project')).toBeInTheDocument();
    });

    it('filters by project when selected', async () => {
        render(<TaskImportModal isOpen={true} onClose={() => { }} />);

        await waitFor(() => screen.getByText('Main Project'));

        // Click Main Project
        fireEvent.click(screen.getByText('Main Project'));

        // Click Search
        fireEvent.click(screen.getByText('搜尋'));

        await waitFor(() => {
            // Check if fetch called with project_id
            const calls = (globalThis.fetch as any).mock.calls;
            const searchCall = calls.find((call: any[]) => call[0].includes('/search'));
            expect(searchCall).toBeTruthy();
            expect(searchCall[0]).toContain('project_id=1');
        });
    });
});
