'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import {
  useCompanyWorkspaceData,
  type WorkspaceJob,
} from '../components/workspace/useCompanyWorkspaceData';

export type BrokerCommercialTermsAvailability = 'loading' | 'available' | 'unavailable';

type BrokerCommercialTerm = {
  job_id: string;
  owner_company_id: string;
  customer_price: number | null;
  target_carrier_cost: number | null;
  currency: string | null;
  updated_at: string | null;
};

type CommercialTermsState = {
  availability: BrokerCommercialTermsAvailability;
  error: string;
  terms: BrokerCommercialTerm[];
};

const finiteOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const uniqueMessages = (messages: string[]) => [...new Set(messages.filter((message) => message.trim().length > 0))];

export function useBrokerCommercialWorkspaceData() {
  const base = useCompanyWorkspaceData();
  const [commercial, setCommercial] = useState<CommercialTermsState>({
    availability: 'loading',
    error: '',
    terms: [],
  });

  const loadCommercialTerms = useCallback(async () => {
    if (!base.companyId) {
      setCommercial({
        availability: 'unavailable',
        error: 'Broker commercial terms are unavailable because no active company context is resolved.',
        terms: [],
      });
      return;
    }
    if (!isSupabaseConfigured) {
      setCommercial({
        availability: 'unavailable',
        error: 'Broker commercial terms are unavailable because Supabase is not configured.',
        terms: [],
      });
      return;
    }

    setCommercial((current) => ({ ...current, availability: 'loading', error: '' }));

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setCommercial({
        availability: 'unavailable',
        error: 'Broker commercial terms are unavailable because the authenticated session could not be resolved.',
        terms: [],
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/broker/commercial-terms?companyId=${encodeURIComponent(base.companyId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        },
      );
      const payload = await response.json().catch(() => ({})) as {
        terms?: Array<Record<string, unknown>>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Broker commercial terms could not be loaded.');
      }

      const terms = (payload.terms ?? [])
        .map((row): BrokerCommercialTerm | null => {
          const jobId = typeof row.job_id === 'string' ? row.job_id : '';
          const ownerCompanyId = typeof row.owner_company_id === 'string' ? row.owner_company_id : '';
          if (!jobId || ownerCompanyId !== base.companyId) return null;
          return {
            job_id: jobId,
            owner_company_id: ownerCompanyId,
            customer_price: finiteOrNull(row.customer_price),
            target_carrier_cost: finiteOrNull(row.target_carrier_cost),
            currency: typeof row.currency === 'string' ? row.currency : null,
            updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
          };
        })
        .filter((row): row is BrokerCommercialTerm => Boolean(row));

      setCommercial({ availability: 'available', error: '', terms });
    } catch (reason) {
      setCommercial({
        availability: 'unavailable',
        error: reason instanceof Error ? reason.message : 'Broker commercial terms could not be loaded.',
        terms: [],
      });
    }
  }, [base.companyId]);

  useEffect(() => {
    void loadCommercialTerms();
  }, [loadCommercialTerms]);

  const termsByJobId = useMemo(
    () => new Map(commercial.terms.map((term) => [term.job_id, term])),
    [commercial.terms],
  );

  const jobs = useMemo<WorkspaceJob[]>(
    () => base.jobs.map((job) => ({
      ...job,
      // Compatibility projection for existing Broker UI only. Raw jobs no
      // longer carry Broker customer revenue after the privacy migration.
      budget_amount: commercial.availability === 'available'
        ? termsByJobId.get(job.id)?.customer_price ?? null
        : null,
    })),
    [base.jobs, commercial.availability, termsByJobId],
  );

  const commercialError = commercial.availability === 'unavailable' ? commercial.error : '';
  const datasets = useMemo(() => {
    const jobErrors = uniqueMessages([
      ...base.datasets.jobs.queryErrors,
      ...(commercialError ? [commercialError] : []),
    ]);
    return {
      ...base.datasets,
      jobs: {
        ...base.datasets.jobs,
        data: jobs,
        queryErrors: jobErrors,
        partialData: base.datasets.jobs.partialData || Boolean(commercialError),
      },
    };
  }, [base.datasets, commercialError, jobs]);

  const refresh = useCallback(async () => {
    await base.refresh();
    await loadCommercialTerms();
  }, [base.refresh, loadCommercialTerms]);

  const error = uniqueMessages([base.error, commercialError]).join(' ');

  return {
    ...base,
    jobs,
    datasets,
    error,
    partialData: base.partialData || Boolean(commercialError),
    refresh,
    commercialTermsAvailability: commercial.availability,
    commercialTermsError: commercial.error,
    commercialTermsByJobId: termsByJobId,
  };
}
