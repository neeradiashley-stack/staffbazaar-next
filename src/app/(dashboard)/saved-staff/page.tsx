'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type MockWorker } from '@/services/mock/workers';
import { useSavedStaff } from '@/contexts/SavedStaffContext';
import { useWorkers } from '@/contexts/WorkersContext';
import { StaffCard } from '@/components/staff/StaffCard';
import { ShortlistModal } from '@/components/staff/ShortlistModal';

export default function SavedStaffPage() {
  const { savedIds, count } = useSavedStaff();
  const { workers } = useWorkers();
  const [shortlistTarget, setShortlistTarget] = useState<MockWorker | null>(null);
  const [toast, setToast] = useState('');

  const visible = workers.filter((w) => savedIds.includes(w.id));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  return (
    <>
      <div className="page-top">
        <div>
          <h1>Saved Staff</h1>
          <p>Your favorite candidates, ready to contact anytime</p>
        </div>
        <div className="result-count-chip">
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14, color: 'var(--ember)' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>{count}</span> saved
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__art empty-state__art--gold">
            <svg viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h3>No saved staff yet</h3>
          <p>
            Tap the star on any staff card to save candidates you like. They will show up here for
            quick access.
          </p>
          <div className="empty-state__actions">
            <Link href="/browse-staff" className="btn-primary">
              Browse Staff
            </Link>
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
