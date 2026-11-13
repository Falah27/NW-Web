"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CLOSE_MS = 200;

export default function useDialogTransition({ onClose, duration = CLOSE_MS }: { onClose: () => void; duration?: number }) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      onClose();
      return;
    }
    timerRef.current = window.setTimeout(onClose, duration);
  }, [closing, duration, onClose]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return { closing, requestClose };
}
