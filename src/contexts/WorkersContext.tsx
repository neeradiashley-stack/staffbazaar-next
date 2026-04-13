'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import {
  type MockWorker,
  type WorkerRole,
  type Availability,
} from '@/services/mock/workers';

interface WorkersContextValue {
  workers: MockWorker[];
  loading: boolean;
  getById: (id: string) => MockWorker | undefined;
}

const WorkersContext = createContext<WorkersContextValue | undefined>(undefined);

type WorkerRow = {
  id: string;
  name: string;
  role: string;
  role_label: string;
  city: string | null;
  availability: Availability | null;
  experience: number | null;
  salary: number | null;
  rating: number | null;
  phone: string | null;
  avatar: string | null;
  initials: string | null;
  verified: boolean | null;
};

function rowToWorker(r: WorkerRow): MockWorker {
  return {
    id: r.id,
    name: r.name,
    role: r.role as WorkerRole,
    roleLabel: r.role_label,
    city: r.city ?? '',
    availability: (r.availability ?? 'month') as Availability,
    experience: r.experience ?? 0,
    salary: r.salary ?? 0,
    rating: r.rating ?? 0,
    phone: r.phone ?? '',
    avatar: r.avatar ?? undefined,
    initials: r.initials ?? '',
    verified: r.verified ?? true,
  };
}

export function WorkersProvider({ children }: { children: ReactNode }) {
  const [workers, setWorkers] = useState<MockWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) console.error('[workers] load failed', error);
      else if (data) setWorkers((data as WorkerRow[]).map(rowToWorker));
      setLoading(false);
    })();

    const channel = supabase
      .channel('workers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as WorkerRow;
            setWorkers((prev) =>
              prev.some((w) => w.id === row.id) ? prev : [...prev, rowToWorker(row)],
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as WorkerRow;
            setWorkers((prev) => prev.map((w) => (w.id === row.id ? rowToWorker(row) : w)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setWorkers((prev) => prev.filter((w) => w.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo<WorkersContextValue>(
    () => ({
      workers,
      loading,
      getById: (id: string) => workers.find((w) => w.id === id),
    }),
    [workers, loading],
  );

  return <WorkersContext.Provider value={value}>{children}</WorkersContext.Provider>;
}

export function useWorkers() {
  const ctx = useContext(WorkersContext);
  if (!ctx) throw new Error('useWorkers must be used within WorkersProvider');
  return ctx;
}
