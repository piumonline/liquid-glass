import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pointer-driven drag. The grabbed element captures the pointer, so the
 * gesture keeps tracking even when the cursor outruns the element.
 *
 * @param {{x:number, y:number}} initial  top-left position in px
 */
export default function useDrag(initial) {
  const [position, setPosition] = useState(initial);
  const anchor = useRef(null);
  const targetRef = useRef(null);

  const onPointerDown = useCallback(
    (event) => {
      // Ignore secondary mouse buttons.
      if (typeof event.button === 'number' && event.button !== 0) return;
      event.preventDefault();

      anchor.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: position.x,
        y: position.y,
      };

      const el = event.currentTarget;
      targetRef.current = el;
      if (el.setPointerCapture && event.pointerId != null) {
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* capture is best-effort */
        }
      }
    },
    [position.x, position.y],
  );

  const onPointerMove = useCallback((event) => {
    const a = anchor.current;
    if (!a) return;
    setPosition({
      x: a.x + (event.clientX - a.pointerX),
      y: a.y + (event.clientY - a.pointerY),
    });
  }, []);

  const stop = useCallback((event) => {
    anchor.current = null;
    const el = targetRef.current;
    if (el?.releasePointerCapture && event?.pointerId != null) {
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        /* nothing to release */
      }
    }
  }, []);

  // If the element unmounts mid-drag, don't leave the gesture latched.
  useEffect(() => () => {
    anchor.current = null;
  }, []);

  return {
    position,
    setPosition,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerCancel: stop,
    },
  };
}
