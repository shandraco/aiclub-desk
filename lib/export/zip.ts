import { strToU8, zipSync, type Zippable } from "fflate";

/**
 * One zip from named files. PNGs are already compressed, so they are stored (level 0);
 * text is deflated. Pure: works in the browser and in tests.
 */
export function buildZip(files: { name: string; data: Uint8Array | string }[]): Uint8Array {
  const z: Zippable = {};
  for (const f of files) {
    z[f.name] = typeof f.data === "string" ? [strToU8(f.data), { level: 6 }] : [f.data, { level: 0 }];
  }
  return zipSync(z);
}
