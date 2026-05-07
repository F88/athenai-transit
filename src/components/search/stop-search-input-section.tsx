import type { KeyboardEvent } from 'react';

interface StopSearchInputSectionProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Input row used at the top of the stop search dialog.
 *
 * Pure layout — owns no state. Keyboard navigation is wired by the parent
 * via {@link StopSearchInputSectionProps.onInputKeyDown} so the dialog can
 * keep result selection, IME handling, and Enter activation in one place.
 */
export function StopSearchInputSection({
  inputRef,
  placeholder,
  query,
  onQueryChange,
  onInputKeyDown,
}: StopSearchInputSectionProps) {
  return (
    <div className="border-border shrink-0 border-b px-4 py-3">
      <input
        ref={inputRef}
        type="text"
        className="border-input bg-background focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2"
        placeholder={placeholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onInputKeyDown}
      />
    </div>
  );
}
