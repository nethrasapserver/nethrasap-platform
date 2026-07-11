// Ambient types for window globals populated by legacy bundles in /public/legacy/*.
// These mirror what data.js, icons.js, images.js, data-portal.js attach to window.
declare global {
  interface Window {
    NETHRA_DATA?: Record<string, any>;
    NETHRA_PORTAL?: Record<string, any>;
    Icons?: Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string; style?: React.CSSProperties }>>;
    IMG?: Record<string, (w?: number, h?: number, q?: number) => string>;
    React?: typeof import("react");
    resolveHomeIcon?: (name: string) => React.ComponentType<any>;
  }
}
export {};
