import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseDraggableOptions {
    initialPosition?: Position;
    storageKey?: string;
}

export function useDraggable({ initialPosition = { x: 0, y: 0 }, storageKey }: UseDraggableOptions = {}) {
    const [position, setPosition] = useState<Position>(() => {
        if (storageKey) {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse saved position', e);
                }
            }
        }
        return initialPosition;
    });

    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const initialDragPosition = useRef(position);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only allow left mouse button
        if (e.button !== 0) return;

        // Prevent default only if it's not an interactive element like input or button
        // But for a drag handle, we usually want to prevent text selection
        // e.preventDefault(); 
        // We probably shouldn't prevent default globally here in case the user clicks something inside.
        // Let the component decide where to attach the handler.

        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        initialDragPosition.current = position;

        document.body.style.userSelect = 'none'; // Prevent selection while dragging
    }, [position]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;

            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;

            const newX = initialDragPosition.current.x + dx;
            const newY = initialDragPosition.current.y + dy;

            // Optional: Add boundary checking here if needed
            // For now, we allow dragging anywhere.

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                document.body.style.userSelect = '';

                if (storageKey) {
                    // Save final position to storage using the latest state from the setter if needed, 
                    // but here we know 'position' in the closure might be stale if we relied on it directly in dependencies
                    // However, we are updating state. 
                    // To get the absolute latest value for storage, we can use a ref or just rely on the next render effect.
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [storageKey]); // removed dependencies that change during drag to avoid re-attaching listeners

    // Effect to save to storage when position changes, but debounced or just on change
    useEffect(() => {
        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(position));
        }
    }, [position, storageKey]);

    return {
        position,
        handleMouseDown,
        isDragging: isDragging.current // This ref value won't trigger re-renders, if you need reactive state for styling during drag, use a state.
    };
}
