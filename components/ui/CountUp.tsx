"use client";

import { useEffect, useRef, useState } from "react";

export default function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = reduce ? 1 : Math.min(1, (now - started) / 600);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{display}</span>;
}
