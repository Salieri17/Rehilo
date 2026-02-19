import "./view-switcher.css";

type ViewMode = "dashboard" | "list" | "graph" | "node";

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  dashboard: "Dashboard",
  list: "List",
  graph: "Graph",
  node: "Node"
};

export default function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className="view-switcher">
      {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          className={mode === value ? "active" : ""}
          onClick={() => onChange(mode)}
        >
          {VIEW_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
