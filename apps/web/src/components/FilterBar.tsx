import type { ChangeEvent } from "react";
import "./filter-bar.css";

interface FilterBarProps {
  workspaces: string[];
  types: string[];
  tags: string[];
  workspaceId: string;
  typeFilter: string;
  tagQuery: string;
  dateFrom: string;
  dateTo: string;
  onWorkspaceChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onTagQueryChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export default function FilterBar(props: FilterBarProps) {
  const {
    workspaces,
    types,
    tags,
    workspaceId,
    typeFilter,
    tagQuery,
    dateFrom,
    dateTo,
    onWorkspaceChange,
    onTypeChange,
    onTagQueryChange,
    onDateFromChange,
    onDateToChange
  } = props;

  const handleWorkspace = (event: ChangeEvent<HTMLSelectElement>) =>
    onWorkspaceChange(event.target.value);
  const handleType = (event: ChangeEvent<HTMLSelectElement>) => onTypeChange(event.target.value);
  const handleTagQuery = (event: ChangeEvent<HTMLInputElement>) =>
    onTagQueryChange(event.target.value);
  const handleDateFrom = (event: ChangeEvent<HTMLInputElement>) => onDateFromChange(event.target.value);
  const handleDateTo = (event: ChangeEvent<HTMLInputElement>) => onDateToChange(event.target.value);

  return (
    <div className="filter-bar">
      <label className="filter-field">
        <span>Workspace</span>
        <select value={workspaceId} onChange={handleWorkspace}>
          <option value="all">All</option>
          {workspaces.map((workspace) => (
            <option key={workspace} value={workspace}>
              {workspace}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Type</span>
        <select value={typeFilter} onChange={handleType}>
          <option value="all">All</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Tags</span>
        <input
          type="text"
          placeholder={tags.length > 0 ? `Try ${tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}` : "#tag"}
          value={tagQuery}
          onChange={handleTagQuery}
        />
      </label>

      <label className="filter-field">
        <span>Date from</span>
        <input type="date" value={dateFrom} onChange={handleDateFrom} />
      </label>

      <label className="filter-field">
        <span>Date to</span>
        <input type="date" value={dateTo} onChange={handleDateTo} />
      </label>
    </div>
  );
}
