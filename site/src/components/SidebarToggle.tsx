import { useState } from "preact/hooks";

const COLLAPSE_KEY = "gamekit-sidebar-collapsed";

/** Collapsed/expanded state for the step sidebar, shared across tracks and
 *  persisted so it stays the way the user left it. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }
  return [collapsed, toggle];
}

/** The button that shrinks the sidebar to a rail (lives in its lower-left). */
export function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand menu" : "Collapse menu";
  return (
    <button class="sidebar-toggle" onClick={onToggle} title={label} aria-label={label}>
      <span class="sidebar-toggle-icon" aria-hidden="true">{collapsed ? "»" : "«"}</span>
      <span class="sidebar-toggle-label">Collapse</span>
    </button>
  );
}
