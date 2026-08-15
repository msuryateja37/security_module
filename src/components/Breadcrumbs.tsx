import React, { createContext, useContext, useEffect, useRef } from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  onClick?: () => void;
}

type TailInput = Crumb | string | null | undefined | false;

// App owns the breadcrumb trail; views with internal navigation (tabs, opened
// records) publish their current sub-location through this context.
const BreadcrumbTailContext = createContext<(tail: Crumb[]) => void>(() => {});

export const BreadcrumbTailProvider = BreadcrumbTailContext.Provider;

/**
 * Appends the given crumbs to the global breadcrumb trail while the calling
 * view is mounted. Falsy entries are skipped, so callers can pass
 * conditional labels directly. The tail clears itself on unmount.
 */
export function useBreadcrumbTail(...crumbs: TailInput[]) {
  const setTail = useContext(BreadcrumbTailContext);
  const normalized: Crumb[] = crumbs
    .filter((c): c is Crumb | string => !!c)
    .map(c => (typeof c === 'string' ? { label: c } : c));
  const key = normalized.map(c => c.label).join('›');
  const latest = useRef(normalized);
  latest.current = normalized;

  useEffect(() => {
    setTail(latest.current);
    return () => setTail([]);
  }, [key, setTail]);
}

/**
 * Drops a crumb whose label repeats the one before it. A view that publishes a tail
 * matching its own nav label (e.g. "My Profile" > "Profile") would otherwise render the
 * same page twice in the trail (NAV-003). Comparison ignores case, surrounding space and
 * a leading "My ", which is how these duplicates actually present.
 */
const normalizeLabel = (label: string) =>
  label.trim().toLowerCase().replace(/^my\s+/, '');

const dedupeCrumbs = (items: Crumb[]): Crumb[] =>
  items.filter((item, idx) => {
    if (idx === 0) return true;
    return normalizeLabel(item.label) !== normalizeLabel(items[idx - 1].label);
  });

export const Breadcrumbs: React.FC<{ items: Crumb[] }> = ({ items: rawItems }) => {
  const items = dedupeCrumbs(rawItems);

  // Root pages (Dashboard) need no trail
  if (items.length <= 1) return null;

  return (
    <nav className="breadcrumb-bar" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="breadcrumb-item">
              {idx > 0 && <ChevronRight size={13} className="breadcrumb-sep" aria-hidden="true" />}
              {isLast ? (
                <span className="breadcrumb-current" aria-current="page">
                  {idx === 0 && <Home size={13} />}
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="breadcrumb-link"
                  onClick={item.onClick}
                  disabled={!item.onClick}
                >
                  {idx === 0 && <Home size={13} />}
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
