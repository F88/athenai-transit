/**
 * Split a CSV line into fields per RFC 4180.
 *
 * Handles double-quoted fields containing commas, newlines, and escaped
 * quotes (`""`). Unquoted fields are returned as-is.
 *
 * @param line - A single CSV line (without trailing newline)
 * @returns Array of field values
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  const len = line.length;

  while (i <= len) {
    if (i === len) {
      // Trailing comma produces an empty final field
      fields.push('');
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < len) {
        if (line[i] === '"') {
          if (i + 1 < len && line[i + 1] === '"') {
            // Escaped quote
            value += '"';
            i += 2;
          } else {
            // Closing quote
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma after closing quote
      if (i < len && line[i] === ',') {
        i++;
      } else {
        break;
      }
    } else {
      // Unquoted field
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.substring(i));
        break;
      } else {
        fields.push(line.substring(i, commaIdx));
        i = commaIdx + 1;
      }
    }
  }

  return fields;
}
