'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type MockWorker } from '@/services/mock/workers';
import { useWorkers } from '@/contexts/WorkersContext';
import { getWorkerProfile } from '@/services/mock/workerProfiles';
import { ProfileHero } from '@/components/candidate/ProfileHero';
import { StatsBanner } from '@/components/candidate/StatsBanner';
import { ExperienceTimeline } from '@/components/candidate/ExperienceTimeline';
import { NotesCard } from '@/components/candidate/NotesCard';
import { RatingCard } from '@/components/candidate/RatingCard';
import { ContactSideCard } from '@/components/candidate/ContactSideCard';
import { VerificationSideCard } from '@/components/candidate/VerificationSideCard';
import { ShortlistModal } from '@/components/staff/ShortlistModal';

export function CandidateClient({ workerId }: { workerId: string }) {
  const { getById, loading } = useWorkers();
  const worker = getById(workerId);
  const [shortlistOpen, setShortlistOpen] = useState<MockWorker | null>(null);
  const [toast, setToast] = useState('');

  if (loading) {
    return (
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 16 }}>
        Loading…
      </h1>
    );
  }

  if (!worker) {
    return (
      <>
        <Link href="/browse-staff" style={{ color: 'var(--ember)', fontWeight: 700 }}>
          ← Back
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginTop: 16 }}>
          Worker not found
        </h1>
      </>
    );
  }

  const profile = getWorkerProfile(workerId);

  return (
    <>
      <Link
        href="/browse-staff"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--charcoal-light)',
          textDecoration: 'none',
          marginBottom: 18,
        }}
      >
        ← Back
      </Link>

      <ProfileHero worker={worker} profile={profile} onAddToJob={() => setShortlistOpen(worker)} />
      <StatsBanner worker={worker} />

      <div className="detail-cols">
        <div>
          <ExperienceTimeline items={profile.experience} />
          <RatingCard />
          <NotesCard />
        </div>
        <aside>
          <ContactSideCard worker={worker} profile={profile} />
          <VerificationSideCard profile={profile} />
        </aside>
      </div>

      <ShortlistModal
        worker={shortlistOpen}
        onClose={() => setShortlistOpen(null)}
        onPicked={(jobTitle) => {
          setToast(`${shortlistOpen?.name} added to ${jobTitle}`);
          setShortlistOpen(null);
          setTimeout(() => setToast(''), 2200);
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
        .detail-cols { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 968px) { .detail-cols { grid-template-columns: 1fr; } }
        .sb-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--charcoal); color: white; padding: 14px 22px; border-radius: 100px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow-lg); z-index: 400; }
        .sb-toast svg { width: 18px; height: 18px; color: var(--green); }
      `}</style>
    </>
  );
}
