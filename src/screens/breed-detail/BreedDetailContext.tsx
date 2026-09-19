import { createContext, useContext } from 'react';

import type { BreedDetail } from '@/db/repository';

export interface BreedDetailContextValue {
  id: string;
  detail: BreedDetail;
  refreshing: boolean;
}

const BreedDetailContext = createContext<BreedDetailContextValue | null>(null);

export const BreedDetailProvider = BreedDetailContext.Provider;

/** Tab screens under app/breed/[id]/ read the breed loaded once by the layout. */
export function useBreedDetailContext(): BreedDetailContextValue {
  const value = useContext(BreedDetailContext);
  if (!value) throw new Error('useBreedDetailContext must be used inside BreedDetailLayout');
  return value;
}
