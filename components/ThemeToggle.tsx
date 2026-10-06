"use client";

import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Choice = "system" | "light" | "dark";
const choices: { value: Choice; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * Three states, not two. The saved choice is applied
 * before first paint by the inline script in app/layout.tsx; this control only changes it.
 * localStorage is read in an effect, never during render.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from storage after hydration is the point
      if (saved === "light" || saved === "dark") setChoice(saved);
    } catch {}
  }, []);

  function apply(next: Choice) {
    setChoice(next);
    const root = document.documentElement;
    try {
      if (next === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", next);
      }
    } catch {}
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Colour theme</legend>
      <div className={styles.options}>
        {choices.map(({ value, label }) => (
          <label key={value} className={styles.option}>
            <input
              type="radio"
              name="theme"
              value={value}
              checked={choice === value}
              onChange={() => apply(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
