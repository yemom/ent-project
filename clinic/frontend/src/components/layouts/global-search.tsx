'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BedDouble,
  Building2,
  CalendarDays,
  Loader2,
  Receipt,
  Search,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { globalSearch, type SearchHit } from '@/services/api/admin';

const TYPE_ICON: Record<SearchHit['type'], typeof Users> = {
  USER: Users,
  PATIENT: UserRound,
  DOCTOR: Stethoscope,
  APPOINTMENT: CalendarDays,
  INVOICE: Receipt,
  DEPARTMENT: Building2,
};

const SECTION_LABEL: Record<SearchHit['type'], string> = {
  USER: 'Users',
  PATIENT: 'Patients',
  DOCTOR: 'Doctors',
  APPOINTMENT: 'Appointments',
  INVOICE: 'Invoices',
  DEPARTMENT: 'Departments',
};

/** Long enough to avoid a request per keystroke, short enough to feel live. */
const DEBOUNCE_MS = 250;

/** Below this the server returns nothing, so there is no point asking. */
const MIN_QUERY_LENGTH = 2;

/**
 * Cross-entity search for the app shell.
 *
 * <p>Queries the real endpoint and shows whatever the caller is allowed to see —
 * the server decides section by section, so an empty section means "not permitted
 * or no match" rather than something the browser filtered out.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => globalSearch(debounced),
    enabled,
    staleTime: 30_000,
    // Keep the previous results visible while a new query runs, so the dropdown
    // does not flash empty on every keystroke.
    placeholderData: (previous) => previous,
  });

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const sections = enabled
    ? (Object.keys(SECTION_LABEL) as SearchHit['type'][])
        .map((type) => ({ type, hits: data?.[groupKey(type)] ?? [] }))
        .filter((section) => section.hits.length > 0)
    : [];

  const navigate = (link: string) => {
    setOpen(false);
    setQuery('');
    setDebounced('');
    router.push(link);
  };

  return (
    <div ref={containerRef} className="relative hidden flex-1 md:block">
      <div className="flex items-center gap-3 rounded-full border border-border/60 bg-white px-4 py-2 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search patients, doctors, invoices..."
          className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          aria-label="Search the hospital records"
        />
        {isFetching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
      </div>

      {open && enabled ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-white p-2 shadow-soft">
          {sections.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? 'Searching...' : `No matches for "${debounced}".`}
            </p>
          ) : (
            sections.map((section) => {
              const Icon = TYPE_ICON[section.type];
              return (
                <div key={section.type} className="mb-1">
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {SECTION_LABEL[section.type]}
                  </div>
                  {section.hits.map((hit) => (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      type="button"
                      onClick={() => navigate(hit.link)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition',
                        'hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{hit.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Maps a hit type onto the response field that carries that section. */
function groupKey(type: SearchHit['type']) {
  switch (type) {
    case 'USER':
      return 'users';
    case 'PATIENT':
      return 'patients';
    case 'DOCTOR':
      return 'doctors';
    case 'APPOINTMENT':
      return 'appointments';
    case 'INVOICE':
      return 'invoices';
    case 'DEPARTMENT':
      return 'departments';
  }
}