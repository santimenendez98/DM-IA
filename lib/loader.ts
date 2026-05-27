// Simple flag-based loader store.
// loader.start() / loader.stop() are idempotent — multiple starts don't stack.

type Listener = (loading: boolean) => void;

const listeners = new Set<Listener>();
let _active = false;

export const loader = {
  start() {
    if (_active) return;
    _active = true;
    listeners.forEach((l) => l(true));
  },
  stop() {
    if (!_active) return;
    _active = false;
    listeners.forEach((l) => l(false));
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
