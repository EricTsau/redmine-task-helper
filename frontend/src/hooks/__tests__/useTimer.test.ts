import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeAll, afterEach, afterAll, describe, it, expect, vi } from 'vitest';
import { useTimer } from '../useTimer';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock API
const handlers = [
    http.get('http://127.0.0.1:8000/api/v1/timer/current', () => {
        return HttpResponse.json(null);
    }),
    http.post('http://127.0.0.1:8000/api/v1/timer/start', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json({
            id: 1,
            issue_id: body.issue_id,
            start_time: new Date().toISOString(),
            is_running: true,
            comment: body.comment
        });
    }),
    http.post('http://127.0.0.1:8000/api/v1/timer/stop', () => {
        return HttpResponse.json({
            id: 1,
            issue_id: 101,
            start_time: new Date().toISOString(),
            duration: 60,
            is_running: false
        });
    })
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useTimer', () => {
    it('should initialize with null timer', async () => {
        const { result } = renderHook(() => useTimer());
        await waitFor(() => expect(result.current.timer).toBeNull());
    });

    it('should start timer', async () => {
        const { result } = renderHook(() => useTimer());

        await act(async () => {
            await result.current.startTimer(101, 'Test Comment');
        });

        await waitFor(() => {
            expect(result.current.timer).not.toBeNull();
            expect(result.current.timer?.issue_id).toBe(101);
            expect(result.current.timer?.is_running).toBe(true);
        });
    });
});
