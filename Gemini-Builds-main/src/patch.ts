// Sandboxed iframe safety patch: make fetch writable to prevent libraries from crashing on fetch assignment
try {
  const originalFetch = window.fetch || (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined);
  if (originalFetch) {
    Object.defineProperty(window, 'fetch', {
      value: originalFetch,
      writable: true,
      configurable: true,
      enumerable: true
    });
    if (typeof globalThis !== 'undefined' && globalThis !== window) {
      Object.defineProperty(globalThis, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  }
} catch (e) {
  console.warn("[Sandbox Patch] Failed to redefine fetch as writable:", e);
}
