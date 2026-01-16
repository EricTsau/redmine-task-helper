import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { Dashboard } from '../../pages/Dashboard';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BrowserRouter } from 'react-router-dom';

// Mock Timer
vi.mock('@/components/timer/Timer', () => ({
    Timer: () => <div data-testid="timer-mock">Timer</div>
}));

const handlers = [
    http.get('http://127.0.0.1:8000/api/v1/timer/current', () => {
        return HttpResponse.json(null); // No timer initially
    }),
    http.get('http://127.0.0.1:8000/api/v1/tasks/', () => {
        return HttpResponse.json([
            { id: 1, subject: 'Task 1', project_name: 'P1', status_name: 'New', updated_on: '2023-01-01' }
        ]);
    })
];

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Dashboard', () => {
    it('should render Task List when no timer is running', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('My Tasks')).toBeInTheDocument();
            expect(screen.getByText('Task 1')).toBeInTheDocument();
        });
    });
});
