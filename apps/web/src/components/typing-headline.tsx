"use client";

import { useEffect, useMemo, useState } from "react";

type TypingHeadlineProps = {
  lines: string[];
};

const TYPE_DELAY = 68;
const DELETE_DELAY = 34;
const HOLD_DELAY = 1500;
const EMPTY_DELAY = 260;

export function TypingHeadline({ lines }: TypingHeadlineProps) {
  const normalizedLines = useMemo(() => lines.filter(Boolean), [lines]);
  const [lineIndex, setLineIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const currentLine = normalizedLines[lineIndex] ?? "";
  const currentCharacters = useMemo(() => Array.from(currentLine), [currentLine]);
  const shouldAnimate = !prefersReducedMotion && normalizedLines.length > 1;
  const displayText = shouldAnimate ? currentCharacters.slice(0, characterCount).join("") : currentLine;
  const longestLine = useMemo(
    () => normalizedLines.reduce((longest, line) => (line.length > longest.length ? line : longest), ""),
    [normalizedLines],
  );

  useEffect(() => {
    if (prefersReducedMotion || normalizedLines.length <= 1) {
      return;
    }

    const lineLength = currentCharacters.length;
    let delay = isDeleting ? DELETE_DELAY : TYPE_DELAY;

    if (!isDeleting && characterCount === lineLength) {
      delay = HOLD_DELAY;
    } else if (isDeleting && characterCount === 0) {
      delay = EMPTY_DELAY;
    }

    const timeout = window.setTimeout(() => {
      if (!isDeleting && characterCount < lineLength) {
        setCharacterCount((count) => count + 1);
        return;
      }

      if (!isDeleting && characterCount === lineLength) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && characterCount > 0) {
        setCharacterCount((count) => count - 1);
        return;
      }

      setIsDeleting(false);
      setLineIndex((index) => (index + 1) % normalizedLines.length);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [characterCount, currentCharacters, currentLine, isDeleting, normalizedLines.length, prefersReducedMotion]);

  if (normalizedLines.length === 0) {
    return null;
  }

  return (
    <span className="relative inline-grid min-h-[2.2em] align-top" aria-label={currentLine}>
      <span className="invisible col-start-1 row-start-1 whitespace-normal">{longestLine}</span>
      <span className="col-start-1 row-start-1 whitespace-normal">
        {displayText}
        <span className="ml-1 inline-block h-[0.82em] w-[0.08em] translate-y-[0.08em] animate-pulse rounded-full bg-white/85" aria-hidden="true" />
      </span>
    </span>
  );
}
