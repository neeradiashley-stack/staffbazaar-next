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
import { type MockJob, type JobStatus } from '@/services/mock/jobs';

interface JobsContextValue {
  jobs: MockJob[];
  postsUsed: number;
  postsLimit: number;
  quotaReached: boolean;
  loading: boolean;
  addJob: (job: Omit<MockJob, 'id'> & { id?: string }, opts?: { consumeQuota?: boolean }) => Promise<MockJob>;
  updateJob: (id: string, patch: Partial<MockJob>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  countByStatus: (status: JobStatus) => number;
  activeCount: number;
}

const JobsContext = createContext<JobsContextValue | undefined>(undefined);

type JobRow = {
  id: string;
  title: string;
  role: string;
  status: JobStatus;
  applicants: number;
  new_today: number;
  views: number;
  posted_days_ago: number;
  salary_min: number;
  salary_max: number;
  shift: string | null;
  job_type: string | null;
  tips: boolean | null;
  description: string | null;
};

function rowToJob(r: JobRow): MockJob {
  return {
    id: r.id,
    title: r.title,
    role: r.role,
    status: r.status,
    applicants: r.applicants,
    newToday: r.new_today,
    views: r.views,
    postedDaysAgo: r.posted_days_ago,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    shift: r.shift ?? '',
    jobType: r.job_type ?? '',
    tips: r.tips ?? false,
    description: r.description ?? '',
  };
}

function jobToRow(j: Partial<MockJob>): Partial<JobRow> {
  const row: Partial<JobRow> = {};
  if (j.id !== undefined) row.id = j.id;
  if (j.title !== undefined) row.title = j.title;
  if (j.role !== undefined) row.role = j.role;
  if (j.status !== undefined) row.status = j.status;
  if (j.applicants !== undefined) row.applicants = j.applicants;
  if (j.newToday !== undefined) row.new_today = j.newToday;
  if (j.views !== undefined) row.views = j.views;
  if (j.postedDaysAgo !== undefined) row.posted_days_ago = j.postedDaysAgo;
  if (j.salaryMin !== undefined) row.salary_min = j.salaryMin;
  if (j.salaryMax !== undefined) row.salary_max = j.salaryMax;
  if (j.shift !== undefined) row.shift = j.shift;
  if (j.jobType !== undefined) row.job_type = j.jobType;
  if (j.tips !== undefined) row.tips = j.tips;
  if (j.description !== undefined) row.description = j.description;
  return row;
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<MockJob[]>([]);
  const [postsUsed, setPostsUsed] = useState(0);
  const [postsLimit, setPostsLimit] = useState(3);
  const [loading, setLoading] = useState(true);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ data: jobRows, error: jobErr }, { data: settings, error: setErr }] =
        await Promise.all([
          supabase.from('jobs').select('*').order('created_at', { ascending: false }),
          supabase.from('app_settings').select('posts_used, posts_limit').eq('id', 1).single(),
        ]);

      if (cancelled) return;

      if (jobErr) console.error('[jobs] load failed', jobErr);
      else if (jobRows) setJobs((jobRows as JobRow[]).map(rowToJob));

      if (setErr) console.error('[app_settings] load failed', setErr);
      else if (settings) {
        setPostsUsed(settings.posts_used ?? 0);
        setPostsLimit(settings.posts_limit ?? 3);
      }

      setLoading(false);
    })();

    const jobsChannel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as JobRow;
            setJobs((prev) =>
              prev.some((j) => j.id === row.id) ? prev : [rowToJob(row), ...prev],
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as JobRow;
            setJobs((prev) => prev.map((j) => (j.id === row.id ? rowToJob(row) : j)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setJobs((prev) => prev.filter((j) => j.id !== old.id));
          }
        },
      )
      .subscribe();

    const settingsChannel = supabase
      .channel('app-settings-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (payload) => {
          const row = payload.new as { posts_used: number; posts_limit: number };
          setPostsUsed(row.posts_used);
          setPostsLimit(row.posts_limit);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  const addJob = useCallback<JobsContextValue['addJob']>(
    async (job, opts) => {
      const created: MockJob = {
        ...job,
        id: job.id ?? `job-${Date.now()}`,
      };

      setJobs((prev) => (prev.some((j) => j.id === created.id) ? prev : [created, ...prev]));

      const { error } = await supabase.from('jobs').insert(jobToRow(created));
      if (error) {
        console.error('[jobs] insert failed', error);
        setJobs((prev) => prev.filter((j) => j.id !== created.id));
        throw error;
      }

      if (opts?.consumeQuota && created.status === 'active') {
        const next = postsUsed + 1;
        setPostsUsed(next);
        const { error: qErr } = await supabase
          .from('app_settings')
          .update({ posts_used: next })
          .eq('id', 1);
        if (qErr) {
          console.error('[app_settings] quota update failed', qErr);
          setPostsUsed(postsUsed);
        }
      }

      return created;
    },
    [postsUsed],
  );

  const updateJob = useCallback<JobsContextValue['updateJob']>(async (id, patch) => {
    const prevSnapshot = jobs;
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

    const { error } = await supabase.from('jobs').update(jobToRow(patch)).eq('id', id);
    if (error) {
      console.error('[jobs] update failed', error);
      setJobs(prevSnapshot);
      throw error;
    }
  }, [jobs]);

  const deleteJob = useCallback<JobsContextValue['deleteJob']>(async (id) => {
    const prevSnapshot = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== id));

    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      console.error('[jobs] delete failed', error);
      setJobs(prevSnapshot);
      throw error;
    }
  }, [jobs]);

  const countByStatus = useCallback(
    (status: JobStatus) => jobs.filter((j) => j.status === status).length,
    [jobs],
  );

  const value = useMemo<JobsContextValue>(
    () => ({
      jobs,
      postsUsed,
      postsLimit,
      quotaReached: postsUsed >= postsLimit,
      loading,
      addJob,
      updateJob,
      deleteJob,
      countByStatus,
      activeCount: jobs.filter((j) => j.status === 'active').length,
    }),
    [jobs, postsUsed, postsLimit, loading, addJob, updateJob, deleteJob, countByStatus],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobs must be used within JobsProvider');
  return ctx;
}
