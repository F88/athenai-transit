export type ListTarget = 'sources' | 'sections';

export type MultiSourceCliMode =
  | { kind: 'help'; sections: string[] }
  | { kind: 'list'; target: ListTarget; sections: string[] }
  | { kind: 'all'; sections: string[] }
  | { kind: 'sources'; names: string[]; sections: string[] };

export type SectionsOnlyCliMode =
  | { kind: 'help'; sections: string[] }
  | { kind: 'list'; target: 'sections'; sections: string[] }
  | { kind: 'run'; sections: string[] };

interface ParsedArgs {
  kind: 'help' | 'run';
  names: string[];
  sections: string[];
  listTarget: ListTarget | null;
}

function parseCommonArgs(args: string[]): ParsedArgs {
  const sections: string[] = [];
  const names: string[] = [];
  let listTarget: ListTarget | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      return { kind: 'help', names, sections, listTarget };
    }

    if (arg === '--list-sources') {
      if (listTarget !== null) {
        return { kind: 'help', names, sections, listTarget };
      }
      listTarget = 'sources';
      continue;
    }

    if (arg === '--list-sections') {
      if (listTarget !== null) {
        return { kind: 'help', names, sections, listTarget };
      }
      listTarget = 'sections';
      continue;
    }

    if (arg === '--section') {
      const sectionName = args[index + 1];
      if (sectionName === undefined || sectionName.startsWith('-')) {
        return { kind: 'help', names, sections, listTarget };
      }
      sections.push(sectionName);
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      return { kind: 'help', names, sections, listTarget };
    }

    names.push(arg);
  }

  return { kind: 'run', names, sections, listTarget };
}

export function parseArgsForMultiSources(args: string[]): MultiSourceCliMode {
  const parsed = parseCommonArgs(args);

  if (parsed.kind === 'help') {
    return { kind: 'help', sections: parsed.sections };
  }

  if (parsed.listTarget !== null) {
    if (parsed.names.length > 0 || parsed.sections.length > 0) {
      return { kind: 'help', sections: parsed.sections };
    }
    return { kind: 'list', target: parsed.listTarget, sections: parsed.sections };
  }

  if (parsed.names.length > 0) {
    return { kind: 'sources', names: parsed.names, sections: parsed.sections };
  }

  return { kind: 'all', sections: parsed.sections };
}

export function parseArgsForSectionsOnly(args: string[]): SectionsOnlyCliMode {
  const parsed = parseCommonArgs(args);

  if (parsed.kind === 'help') {
    return { kind: 'help', sections: parsed.sections };
  }

  if (parsed.listTarget === 'sources') {
    return { kind: 'help', sections: parsed.sections };
  }

  if (parsed.listTarget === 'sections') {
    if (parsed.names.length > 0 || parsed.sections.length > 0) {
      return { kind: 'help', sections: parsed.sections };
    }
    return { kind: 'list', target: 'sections', sections: parsed.sections };
  }

  if (parsed.names.length > 0) {
    return { kind: 'help', sections: parsed.sections };
  }

  return { kind: 'run', sections: parsed.sections };
}
