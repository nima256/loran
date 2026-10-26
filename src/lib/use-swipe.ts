"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Horizontal swipe between the frames of an image track.
 *
 * The track element gets `touch-action: pan-y`, which hands vertical
 * gestures to the browser (the page scrolls exactly as before) and leaves
 * horizontal ones to us. A gesture is only claimed once it has clearly moved
 * sideways; if it turns out vertical, it is released immediately.
 *
 * Direction follows the RTL layout: frames run right-to-left, so the next
 * frame sits to the left and is pulled in by dragging the finger to the
 * right — the same physical model as the arrows, where "next" points left.
 *
 * Mouse input is ignored: desktop has the arrow buttons and hover, and a
 * mouse drag on a card would fight with clicking its link.
 */

const AXIS_LOCK_PX = 8;
const MIN_SWIPE_PX = 40;
const MIN_VELOCITY = 0.35; // px per ms — a quick flick counts even if short.

export function useSwipe({
  count,
  index,
  onChange,
}: {
  count: number;
  index: number;
  onChange: (next: number) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; t: number; id: number; width: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  /** Set after a real swipe so the click that follows it can be swallowed. */
  const swipedAt = useRef(0);

  const reset = () => {
    start.current = null;
    axis.current = null;
    setDragging(false);
    setOffset(0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || count < 2) return;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      id: event.pointerId,
      width: event.currentTarget.getBoundingClientRect().width || 1,
    };
    axis.current = null;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || event.pointerId !== s.id) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;

    if (!axis.current) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "y") {
        // A scroll, not a swipe: let the browser have it.
        start.current = null;
        return;
      }
      setDragging(true);
      try {
        // Keeps the drag ours if the finger leaves the frame.
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer already ended (or was never a real one); nothing to capture.
      }
    }

    // RTL: dragging right reveals the next frame; resist past either end.
    const atEnd = (dx > 0 && index === count - 1) || (dx < 0 && index === 0);
    setOffset(atEnd ? dx * 0.3 : dx);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || event.pointerId !== s.id || axis.current !== "x") {
      reset();
      return;
    }
    const dx = event.clientX - s.x;
    const velocity = Math.abs(dx) / Math.max(1, event.timeStamp - s.t);
    const far = Math.abs(dx) > Math.max(MIN_SWIPE_PX, s.width * 0.15);
    if (far || velocity > MIN_VELOCITY) {
      const next = dx > 0 ? index + 1 : index - 1;
      if (next >= 0 && next < count) onChange(next);
    }
    swipedAt.current = Date.now();
    reset();
  };

  /** Use as onClickCapture on anything clickable inside the track. */
  const suppressClickAfterSwipe = useCallback((event: React.MouseEvent) => {
    if (Date.now() - swipedAt.current < 400) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      style: { touchAction: "pan-y" } as React.CSSProperties,
    },
    /** Transform for the track: frame `index`, plus the live drag. */
    trackStyle: {
      transform: `translate3d(calc(${index * 100}% + ${offset}px), 0, 0)`,
      transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
    } as React.CSSProperties,
    dragging,
    suppressClickAfterSwipe,
  };
}
