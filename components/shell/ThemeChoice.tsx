"use client";

import { useEffect, useState } from "react";

type Choice = "night" | "day";

/** Night studio is the default; Day is a cool light studio for bright rooms. Applied before paint by the layout script. */
export function ThemeChoice() {
  const [choice, setChoice] = useState<Choice>("night");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from storage after hydration
      if (localStorage.getItem("theme") === "light") setChoice("day");
    } catch {}
  }, []);
  function apply(next: Choice) {
    setChoice(next);
    try {
      if (next === "night") localStorage.removeItem("theme");
      else localStorage.setItem("theme", "light");
    } catch {}
    if (next === "night") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", "light");
  }
  return (
    <fieldset style={{ border: 0, padding: "var(--space-2xs) var(--space-s)", borderBlockEnd: "1px solid var(--rule)" }}>
      <legend className="muted" style={{ fontSize: "var(--text-xs)", paddingBlockEnd: "var(--space-3xs)", float: "left", inlineSize: "100%" }}>Studio</legend>
      <div className="seg">
        {(["night", "day"] as const).map((c) => (
          <label key={c}>
            <input type="radio" name="theme" value={c} checked={choice === c} onChange={() => apply(c)} />
            {c === "night" ? "Night" : "Day"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
