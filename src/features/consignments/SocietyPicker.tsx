import { useMemo, useState } from "react";
import type { Society } from "../../api/types";
import { PersonIcon, SearchIcon } from "../../components/icons";

export function SocietyPicker({
  societies,
  selected,
  onSelect,
  disabled = false,
  error,
}: {
  societies: Society[];
  selected: Society | null;
  onSelect: (society: Society | null) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (term === "") {
      return societies;
    }

    return societies.filter(
      (society) =>
        society.name.toLowerCase().includes(term) ||
        society.canLabelPrefix.toLowerCase().includes(term) ||
        society.code.toLowerCase().includes(term),
    );
  }, [search, societies]);

  if (selected) {
    return (
      <section aria-label="Supplying society">
        <button
          type="button"
          className="societycard"
          onClick={() => onSelect(null)}
          disabled={disabled}
          style={{ width: "100%", textAlign: "left" }}
        >
          <span className="societycard__body">
            <span className="societycard__name">{selected.name}</span>
            <span className="societycard__leader">
              <PersonIcon />
              Leader: <strong>{selected.contactPerson ?? "Not recorded"}</strong>
            </span>
          </span>
          <span className="tag">{selected.canLabelPrefix}</span>
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Supplying society">
      <div className="search">
        <SearchIcon className="search__icon" />
        <label className="sr-only" htmlFor="society-search">
          Search society name or tag
        </label>
        <input
          id="society-search"
          type="search"
          value={search}
          disabled={disabled}
          placeholder="Search society name or tag..."
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="societylist">
        {matches.length === 0 ? (
          <li>
            <p style={{ margin: 0, padding: "12px", color: "var(--ink-muted)", fontSize: 13 }}>
              No society matches that name or tag.
            </p>
          </li>
        ) : (
          matches.map((society) => (
            <li key={society.id}>
              <button
                type="button"
                className="societylist__item"
                onClick={() => onSelect(society)}
                disabled={disabled}
              >
                <span className="tag">{society.canLabelPrefix}</span>
                <span>
                  <strong style={{ display: "block", color: "var(--navy-900)" }}>{society.name}</strong>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {society.contactPerson ?? "No leader recorded"}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
