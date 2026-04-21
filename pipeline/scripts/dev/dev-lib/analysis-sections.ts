export interface AnalysisSectionDefinition<TResult, TSectionName extends string = string> {
  name: TSectionName;
  title: string;
  description: string;
  render: (input: TResult) => string;
}

function normalizeSectionDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ');
}

export function truncateSectionDescription(description: string, maxLength: number): string {
  const normalized = normalizeSectionDescription(description);
  if (maxLength < 4 || normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function formatAnalysisSectionList<TResult, TSectionName extends string>(
  sectionNames: readonly TSectionName[],
  sections: Record<TSectionName, AnalysisSectionDefinition<TResult, TSectionName>>,
  options: { maxDescriptionLength?: number } = {},
): string[] {
  const maxDescriptionLength = options.maxDescriptionLength ?? 72;
  const nameWidth = sectionNames.reduce((maxWidth, sectionName) => {
    return Math.max(maxWidth, sectionName.length);
  }, 0);

  return sectionNames.map((sectionName) => {
    const section = sections[sectionName];
    const description = truncateSectionDescription(section.description, maxDescriptionLength);
    return `${sectionName.padEnd(nameWidth)}  ${description}`;
  });
}
