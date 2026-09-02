import { useMemo, useState } from "react";
import type { Society } from "../../api/types";
import { PersonIcon, SearchIcon } from "../../components/icons";

/**
 * Choosing the supplying society. Nothing is listed until the officer types: they know the name
 * or the tag painted on the cans, so a search keeps the gate screen short instead of scrolling
 * every registered society. Only registered societies can be supplied — there is no free-text option.
 *
 * The search box stays put once a society is chosen — the card appears underneath it rather than
 * replacing it, so picking a society never redraws the top of the screen and the can sheet below
 * stays where the officer left it.
 */
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
  const term = search.trim().toLowerCase();

  const matches = useMemo(() => {
    if (term === "") {
      return [];
    }

    return societies.filter(
      (society) =>
        society.name.toLowerCase().includes(term) ||
        society.canLabelPrefix.toLowerCase().includes(term) ||
        society.code.toLowerCase().includes(term),
    );
  }, [term, societies]);

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
          placeholder={selected ? "Search to change society..." : "Search society name or tag..."}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {term === "" ? null : (
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
                  onClick={() => {
                    setSearch("");
                    onSelect(society);
                  }}
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
      )}

      {selected ? (
        <button
          type="button"
          className="societycard"
          onClick={() => {
            setSearch("");
            onSelect(null);
          }}
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
      ) : null}
    </section>
  );
}
