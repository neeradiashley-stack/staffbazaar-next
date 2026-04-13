'use client';

import { useMemo, useState } from 'react';
import { type MockWorker } from '@/services/mock/workers';
import { useWorkers } from '@/contexts/WorkersContext';
import { StaffCard } from '@/components/staff/StaffCard';
import { FilterBar, initialFilters, type FilterState } from '@/components/staff/FilterBar';
import { ShortlistModal } from '@/components/staff/ShortlistModal';

function matches(w: MockWorker, f: FilterState): boolean {
  if (f.role !== 'all' && w.role !== f.role) return false;
  if (f.availability !== 'all' && w.availability !== f.availability) return false;
  if (f.experience === '0-3' && w.experience > 3) return false;
  if (f.experience === '3-7' && (w.experience < 3 || w.experience > 7)) return false;
  if (f.experience === '7+' && w.experience < 7) return false;
  const sal = w.salary / 1000;
  if (f.salary === '0-20' && sal >= 20) return false;
  if (f.salary === '20-35' && (sal < 20 || sal > 35)) return false;
  if (f.salary === '35+' && sal < 35) return false;
  return true;
}

export default function BrowseStaffPage() {
  const { workers } = useWorkers();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [shortlistTarget, setShortlistTarget] = useState<MockWorker | null>(null);
  const [toast, setToast] = useState('');

  const visible = useMemo(() => workers.filter((w) => matches(w, filters)), [workers, filters]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  return (
    <>
      <div className="page-top">
        <div>
          <h1>Browse Staff</h1>
          <p>Find verified cooks, waiters, bartenders and helpers ready to work</p>
        </div>
        <div className="result-count-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <span>{visible.length}</span> staff available
        </div>
      </div>

      <FilterBar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
      />

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__art empty-state__art--ember">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <h3>No staff found</h3>
          <p>Try removing some filters to see more candidates.</p>
          <div className="empty-state__actions">
            <button type="button" className="btn-secondary" onClick={() => setFilters(initialFilters)}>
              Clear Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="staff-grid" id="staffGrid">
          {visible.map((w) => (
            <StaffCard key={w.id} worker={w} onShortlist={setShortlistTarget} />
          ))}
        </div>
      )}

      <ShortlistModal
        worker={shortlistTarget}
        onClose={() => setShortlistTarget(null)}
        onPicked={(jobTitle) => {
          showToast(`${shortlistTarget?.name} added to ${jobTitle}`);
          setShortlistTarget(null);
        }}
      />

      {toast && (
        <div className="sb-toast show">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      <style>{`
        .page-top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .page-top h1 { font-family: var(--font-display); font-size: 32px; }
        .page-top p { font-size: 14px; color: var(--stone); margin-top: 4px; }
        .result-count-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 100px; background: white; border: 1.5px solid var(--sand); font-size: 13px; font-weight: 700; color: var(--charcoal); }
        .result-count-chip span { color: var(--ember); }
        #staffGrid.staff-grid { display: grid; grid-template-columns: repeat(4, 1fr) !important; gap: 18px !important; }
        @media (max-width: 1140px) { #staffGrid.staff-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 900px) { #staffGrid.staff-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 560px) { #staffGrid.staff-grid { grid-template-columns: 1fr !important; } }
        .sb-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--charcoal); color: white; padding: 14px 22px; border-radius: 100px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow-lg); z-index: 400; }
        .sb-toast svg { width: 18px; height: 18px; color: var(--green); }
      `}</style>
    </>
  );
}
