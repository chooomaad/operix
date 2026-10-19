import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LocalFile } from '@/services/api';
import type { Analysis, EventKind, Incident, IncidentAction } from '@/types/api';
import type { Fix } from '@/hooks/useLocation';

/** Brouillon partagé entre les 3 étapes : saisie → analyse → succès. */
export interface Draft {
  kind: EventKind;
  location: string;
  description: string;
  photo: LocalFile | null;
  fix: Fix | null;
}

export interface Outcome {
  reference: string | null;
  recordId: number | null;
  kind: EventKind;
  offline: boolean;
  incident?: Incident;
  actions: IncidentAction[];
}

interface DeclareState {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  analysis: Analysis | null;
  setAnalysis: (a: Analysis | null) => void;
  outcome: Outcome | null;
  setOutcome: (o: Outcome | null) => void;
  reset: () => void;
}

const empty: Draft = { kind: 'incident', location: '', description: '', photo: null, fix: null };
const Ctx = createContext<DeclareState | null>(null);

export function DeclareProvider({ children }: { children: ReactNode }) {
  const [draft, set] = useState<Draft>(empty);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const value = useMemo<DeclareState>(
    () => ({
      draft,
      setDraft: (patch) => set((d) => ({ ...d, ...patch })),
      analysis,
      setAnalysis,
      outcome,
      setOutcome,
      reset: () => {
        set(empty);
        setAnalysis(null);
        setOutcome(null);
      },
    }),
    [draft, analysis, outcome],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeclare(): DeclareState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDeclare hors DeclareProvider');
  return c;
}
