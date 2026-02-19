import type { KeyboardEvent } from "react";
import "./command-bar.css";

interface CommandBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function CommandBar({ value, onChange, onSubmit }: CommandBarProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="command-bar">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Command: T/ProjectX/Task1 or note text..."
      />
      <button type="button" onClick={onSubmit}>
        Run
      </button>
    </div>
  );
}
