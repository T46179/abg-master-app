import { readDrillSet, type DrillLoader } from "../core/examDrills";

export function isLocalDrillPreview() {
  return import.meta.env.DEV && import.meta.env.MODE === "development"
    && ["127.0.0.1", "localhost"].includes(location.hostname);
}

export const loadLocalDrill: DrillLoader = async (request, signal) => {
  const response = await fetch("/__local/focused-drills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (response.status === 503) throw new Error("The local generator couldn’t load. Use Node 24 and keep abg-master-content next to abg-master-app.");
  if (!response.ok) throw new Error("We couldn’t generate this local drill. Please try again.");
  return readDrillSet(await response.json(), request.count);
};
