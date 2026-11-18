export function examTestLocks(): Pick<LockManager, "request"> {
  const held = new Set<string>();
  return { request: (async <T>(name: string, _options: LockOptions, callback: (lock: Lock | null) => T | PromiseLike<T>) => {
    await Promise.resolve();
    if (held.has(name)) return callback(null);
    held.add(name);
    try { return await callback({ name, mode: "exclusive" }); }
    finally { held.delete(name); }
  }) as LockManager["request"] };
}
