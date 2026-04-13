'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJobs } from '@/contexts/JobsContext';
import type { JobStatus } from '@/services/mock/jobs';
import { ProgressBar } from './ProgressBar';
import { RoleStep } from './RoleStep';
import { DescriptionStep } from './DescriptionStep';
import { CompensationStep } from './CompensationStep';
import { ReviewStep } from './ReviewStep';
import { initialWizard, type WizardData } from './types';

const TOTAL = 4;

export function PostJobWizard() {
  const router = useRouter();
  const { addJob, quotaReached } = useJobs();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialWizard);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  const canContinue = () => {
    if (step === 1) return Boolean(data.role);
    if (step === 2) return data.description.trim().split(/\s+/).length >= 30;
    if (step === 3) return Boolean(data.salaryMin && data.salaryMax && data.shift);
    return true;
  };

  const submit = async (status: JobStatus) => {
    const created = await addJob(
      {
        title: data.role || 'Untitled',
        role: data.role,
        status,
        applicants: 0,
        newToday: 0,
        views: 0,
        postedDaysAgo: 0,
        salaryMin: parseInt(data.salaryMin || '0', 10),
        salaryMax: parseInt(data.salaryMax || '0', 10),
        shift: data.shift || 'Flexible',
        jobType: data.jobType,
        tips: data.tips,
        description: data.description,
      },
      { consumeQuota: status === 'active' },
    );
    router.push(status === 'draft' ? '/my-jobs?tab=draft' : `/my-jobs`);
    return created;
  };

  return (
    <>
      <ProgressBar step={step} total={TOTAL} />

      {quotaReached && step === 1 && (
        <div
          style={{
            maxWidth: 700,
            margin: '20px auto 0',
            padding: 16,
            borderRadius: 12,
            background: '#FEF3C7',
            color: '#92400E',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          ⚠ You&apos;ve used all 3 free job posts this month.{' '}
          <a href="/pricing" style={{ color: '#DC4A1A' }}>
            Upgrade
          </a>{' '}
          to post more.
        </div>
      )}

      <div className="wizard" style={{ maxWidth: 700, paddingTop: 24 }}>
        {step === 1 && <RoleStep data={data} onChange={update} />}
        {step === 2 && <DescriptionStep data={data} onChange={update} />}
        {step === 3 && <CompensationStep data={data} onChange={update} />}
        {step === 4 && (
          <ReviewStep
            data={data}
            onPublish={() => submit('active')}
            onSaveDraft={() => submit('draft')}
            publishDisabled={quotaReached}
          />
        )}
      </div>

      {step < TOTAL && (
        <div className="bottom-bar" style={{ left: 260 }}>
          <div className="bottom-inner" style={{ maxWidth: 700 }}>
            <button
              type="button"
              className={`btn-back${step === 1 ? ' hidden' : ''}`}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-draft"
              onClick={() => submit('draft')}
              style={{
                padding: '14px 24px',
                borderRadius: 'var(--radius-md)',
                background: 'white',
                color: 'var(--charcoal)',
                border: '1.5px solid var(--sand)',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                marginRight: 8,
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="btn-next"
              disabled={!canContinue()}
              onClick={() => setStep((s) => Math.min(TOTAL, s + 1))}
              style={{ opacity: canContinue() ? 1 : 0.5 }}
            >
              {step === TOTAL - 1 ? 'Review' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 968px) { .bottom-bar { left: 0 !important; } }
      `}</style>
    </>
  );
}
