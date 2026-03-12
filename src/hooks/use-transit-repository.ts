import { useContext } from 'react';
import type { TransitRepository } from '../repositories/transit-repository';
import { TransitRepositoryContext } from '../contexts/transit-repository-context';

/**
 * Returns the {@link TransitRepository} from the nearest provider context.
 *
 * Must be called inside a `TransitRepositoryProvider`.
 * Throws if the context is missing.
 *
 * @returns The transit data repository instance.
 */
export function useTransitRepository(): TransitRepository {
  const repo = useContext(TransitRepositoryContext);
  if (!repo) {
    throw new Error('useTransitRepository must be used within a TransitRepositoryProvider');
  }
  return repo;
}
