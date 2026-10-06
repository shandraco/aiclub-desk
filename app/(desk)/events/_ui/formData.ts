import "server-only";
import { libraryChoices, presetCounts } from "@/lib/planning/queries";

/** What the event form needs from the library, shaped for the client picker. */
export async function formChoices(excludeId?: string) {
  const [lib, counts] = await Promise.all([libraryChoices(), presetCounts(excludeId)]);
  return {
    rooms: lib.rooms.map((r) => ({ id: r.id, name: r.name, sub: r.short })),
    speakers: lib.speakers.map((s) => ({ id: s.id, name: s.name, sub: s.role || undefined })),
    partners: lib.partners.map((p) => ({ id: p.id, name: p.name })),
    presetCounts: counts,
  };
}
