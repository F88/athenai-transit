import { createContext } from 'react';
import type { TransitRepository } from '../repositories/transit-repository';

export const TransitRepositoryContext = createContext<TransitRepository | null>(null);
