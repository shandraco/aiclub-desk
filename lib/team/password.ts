import { randomInt } from "node:crypto";
import { passwordProblem } from "@/lib/auth/rules";

/** No 0/o, 1/l/i: the admin may read it aloud or someone may type it from a screenshot. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A temporary password an admin hands to a teammate after a reset: four groups of five,
 * "k7mqa-x3rtp-9wdhe-bn4sz". 20 characters from 31 symbols is about 99 bits, from the
 * operating system's CSPRNG. Passes passwordProblem() for the given username.
 */
export function tempPassword(username = " "): string {
  for (;;) {
    const groups = Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""));
    const p = groups.join("-");
    if (!passwordProblem(p, username)) return p;
  }
}
