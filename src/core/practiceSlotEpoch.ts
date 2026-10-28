// Invalidates outstanding preparation without cancelling a saved submission.
let generation = 0;
export function practiceSlotGeneration() { return generation; }
export function invalidatePracticeSlotRequests() { generation += 1; }
