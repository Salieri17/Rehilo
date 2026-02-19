import "./capture-history.css";

export interface CaptureHistoryItem {
  id: string;
  type: "link" | "note" | "file";
  title: string;
  detail?: string;
  timestamp: string;
}

interface CaptureHistoryPanelProps {
  items: CaptureHistoryItem[];
}

export default function CaptureHistoryPanel({ items }: CaptureHistoryPanelProps) {
  return (
    <div className="panel-card capture-history">
      <h2>Capture history</h2>
      {items.length === 0 ? (
        <p className="meta">No captures yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                {item.detail && <span className="meta">{item.detail}</span>}
              </div>
              <span className="chip">{item.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
