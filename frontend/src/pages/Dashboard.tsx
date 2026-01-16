import { useTimer } from '@/hooks/useTimer';
import { FocusMode } from '@/components/dashboard/FocusMode';
import { TaskListView } from '@/components/dashboard/TaskListView';

export function Dashboard() {
    const { timer, startTimer, stopTimer } = useTimer();

    // If timer is running, show Focus Mode
    // Otherwise show Task List
    if (timer && timer.is_running) {
        return <FocusMode timer={timer} stopTimer={() => stopTimer()} />;
    }

    return <TaskListView startTimer={startTimer} />;
}
