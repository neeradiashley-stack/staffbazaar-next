'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { type MockApplicant, type ApplicantStage } from '@/services/mock/applicants';

interface ApplicantsContextValue {
  applicants: MockApplicant[];
  loading: boolean;
  byJob: (jobId: string) => MockApplicant[];
  byJobAndStage: (jobId: string, stage: ApplicantStage) => MockApplicant[];
  moveTo: (id: string, stage: ApplicantStage) => Promise<void>;
}

const ApplicantsContext = createContext<ApplicantsContextValue | undefined>(undefined);

type ApplicantRow = {
  id: string;
  job_id: string;
  name: string;
  role: string | null;
  experience: number | null;
  salary: number | null;
  rating: number | null;
  phone: string | null;
  avatar: string | null;
  initials: string | null;
  stage: ApplicantStage;
};

function rowToApplicant(r: ApplicantRow): MockApplicant {
  return {
    id: r.id,
    jobId: r.job_id,
    name: r.name,
    role: r.role ?? '',
    experience: r.experience ?? 0,
    salary: r.salary ?? 0,
    rating: r.rating ?? 0,
    phone: r.phone ?? '',
    avatar: r.avatar ?? undefined,
    initials: r.initials ?? '',
    stage: r.stage,
  };
}

export function ApplicantsProvider({ children }: { children: ReactNode }) {
  const [applicants, setApplicants] = useState<MockApplicant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) console.error('[applicants] load failed', error);
      else if (data) setApplicants((data as ApplicantRow[]).map(rowToApplicant));

      setLoading(false);
    })();

    const channel = supabase
      .channel('applicants-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applicants' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as ApplicantRow;
            setApplicants((prev) =>
              prev.some((a) => a.id === row.id) ? prev : [...prev, rowToApplicant(row)],
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as ApplicantRow;
            setApplicants((prev) => prev.map((a) => (a.id === row.id ? rowToApplicant(row) : a)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setApplicants((prev) => prev.filter((a) => a.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const byJob = useCallback(
    (jobId: string) => applicants.filter((a) => a.jobId === jobId),
    [applicants],
  );

  const byJobAndStage = useCallback(
    (jobId: string, stage: ApplicantStage) =>
      applicants.filter((a) => a.jobId === jobId && a.stage === stage),
    [applicants],
  );

  const moveTo = useCallback<ApplicantsContextValue['moveTo']>(async (id, stage) => {
    const snapshot = applicants;
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, stage } : a)));

    const { error } = await supabase.from('applicants').update({ stage }).eq('id', id);
    if (error) {
      console.error('[applicants] moveTo failed', error);
      setApplicants(snapshot);
      throw error;
    }
  }, [applicants]);

  const value = useMemo(
    () => ({ applicants, loading, byJob, byJobAndStage, moveTo }),
    [applicants, loading, byJob, byJobAndStage, moveTo],
  );

  return <ApplicantsContext.Provider value={value}>{children}</ApplicantsContext.Provider>;
}

export function useApplicants() {
  const ctx = useContext(ApplicantsContext);
  if (!ctx) throw new Error('useApplicants must be used within ApplicantsProvider');
  return ctx;
}
