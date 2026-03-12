import type { ReactNode } from 'react';
import type { TransitRepository } from '../repositories/transit-repository';
import { TransitRepositoryContext } from './transit-repository-context';

export function TransitRepositoryProvider({
  repository,
  children,
}: {
  repository: TransitRepository;
  children: ReactNode;
}) {
  return (
    <TransitRepositoryContext.Provider value={repository}>
      {children}
    </TransitRepositoryContext.Provider>
  );
}
