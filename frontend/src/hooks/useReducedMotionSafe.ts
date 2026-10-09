import { useReducedMotion } from 'framer-motion';

/** True when the user prefers reduced motion (false if unknown). */
export function useReducedMotionSafe(): boolean {
  return useReducedMotion() ?? false;
}
