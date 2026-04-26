import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShortcutHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  /** Display label for the key. Used as both visual content and accessible name. */
  keyLabel: string;
  /** i18n key for the human-readable description of what the shortcut does. */
  descriptionKey: string;
}

/**
 * Shortcuts displayed in the help dialog.
 *
 * Kept as a local constant for now. When the third shortcut is added we
 * should hoist this to a config module so the dialog and the actual key
 * handler share a single source of truth.
 */
const SHORTCUTS: readonly ShortcutEntry[] = [
  { keyLabel: '/', descriptionKey: 'shortcut.entry.search' },
  { keyLabel: '?', descriptionKey: 'shortcut.entry.help' },
  { keyLabel: 'Esc', descriptionKey: 'shortcut.entry.close' },
];

/**
 * Modal dialog showing the list of available keyboard shortcuts.
 *
 * Triggered by pressing `?` while no other modal is open. Mirrors the
 * structure of {@link InfoDialog} so the two help-style dialogs feel
 * consistent.
 *
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called when the open state changes.
 */
export function ShortcutHelpDialog({ open, onOpenChange }: ShortcutHelpDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] max-w-[90vw] flex-col gap-0 overflow-hidden border-4">
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          <DialogTitle className="text-base">{t('shortcut.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('shortcut.description')}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto pt-3 text-sm">
          <dl className="flex flex-col gap-2">
            {SHORTCUTS.map((entry) => (
              <div
                key={entry.keyLabel}
                className="flex items-center justify-between gap-4 px-2 py-1"
              >
                <dt className="text-muted-foreground">{t(entry.descriptionKey)}</dt>
                <dd>
                  <kbd className="bg-muted text-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
                    {entry.keyLabel}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
