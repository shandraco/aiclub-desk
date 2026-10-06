import styles from "../library.module.css";

export type Tone = "original" | "white" | "black";

/**
 * The logo as it will be drawn on the club's two grounds, with the tone's filter applied
 * exactly as the graphics do. Server-safe: used in the list and in the editor.
 */
export function LogoGrounds({ url, tone, name, small = false }: { url: string | null; tone: Tone; name: string; small?: boolean }) {
  const cls = tone === "white" ? styles.toneWhite : tone === "black" ? styles.toneBlack : "";
  const g = small ? styles.groundSmall : "";
  return (
    <div className={styles.grounds}>
      <div className={`${styles.ground} ${styles.ivory} ${g}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={`${name} logo on the ivory ground`} className={cls} /> : <span className={styles.groundLabel}>No logo</span>}
      </div>
      <div className={`${styles.ground} ${styles.black} ${g}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={`${name} logo on the black ground`} className={cls} /> : <span className={styles.groundLabel}>No logo</span>}
      </div>
    </div>
  );
}

export function toneWarning(tone: Tone): string | null {
  if (tone === "white") return "A white logo disappears on the ivory ground. Use it only on posts with the black ground.";
  if (tone === "black") return "A black logo disappears on the black ground. Use it only on posts with the ivory ground.";
  return null;
}
