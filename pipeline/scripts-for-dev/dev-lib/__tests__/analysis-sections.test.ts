import { describe, expect, it } from 'vitest';

import {
  formatAnalysisSectionList,
  truncateSectionDescription,
  type AnalysisSectionDefinition,
} from '../analysis-sections';

type TestSectionName = 'alpha' | 'beta-long';

type TestResult = {
  value: number;
};

const TEST_SECTIONS: Record<
  TestSectionName,
  AnalysisSectionDefinition<TestResult, TestSectionName>
> = {
  alpha: {
    name: 'alpha',
    title: 'Alpha',
    description: 'First section for checking formatter behavior.',
    render: () => 'alpha',
  },
  'beta-long': {
    name: 'beta-long',
    title: 'Beta Long',
    description: 'Second section with a deliberately long description for truncation checks.',
    render: () => 'beta',
  },
};

describe('truncateSectionDescription', () => {
  it('normalizes whitespace and truncates long descriptions', () => {
    const output = truncateSectionDescription('  alpha\n  beta   gamma  ', 14);

    expect(output).toBe('alpha beta...');
  });

  it('keeps the full description when it fits', () => {
    const output = truncateSectionDescription('short description', 40);

    expect(output).toBe('short description');
  });
});

describe('formatAnalysisSectionList', () => {
  it('formats section names in order with aligned short descriptions', () => {
    const output = formatAnalysisSectionList(['alpha', 'beta-long'], TEST_SECTIONS, {
      maxDescriptionLength: 28,
    });

    expect(output).toEqual([
      'alpha      First section for checkin...',
      'beta-long  Second section with a del...',
    ]);
  });
});
