import type { CSSProperties } from "react";

export const STAGGER_STEP_MS = 20;
export const STAGGER_MAX_MS = 120;

export const staggerDelayMs = (index: number): number => Math.min(Math.max(0, Math.floor(index)) * STAGGER_STEP_MS, STAGGER_MAX_MS);

export const staggerStyle = (index: number): CSSProperties => ({ "--stagger": `${staggerDelayMs(index)}ms` }) as CSSProperties;
