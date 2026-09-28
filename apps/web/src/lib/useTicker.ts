import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function useTicker(steps: number, interval: number) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) {
      return;
    }
    const timer = window.setInterval(
      () => setStep((current) => (current + 1) % steps),
      interval,
    );
    return () => window.clearInterval(timer);
  }, [reduced, steps, interval]);
  return reduced ? 0 : step;
}
