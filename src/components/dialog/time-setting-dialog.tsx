import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toDatetimeLocalValue } from '@/utils/datetime';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle } from '@/components/ui/alert';

interface TimeSettingDialogProps {
  /** Snapshot of the time when the dialog was opened. Stable while dialog is visible. */
  initialTime: Date;
  isCustomTime: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetToNow: () => void;
  onCustomTimeSet: (date: Date) => void;
}

/**
 * Dialog for setting a custom date/time.
 *
 * @param initialTime - Snapshot of the time captured when the dialog opens.
 * @param isCustomTime - Whether a custom time is currently active.
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called when the open state changes.
 * @param onResetToNow - Called to reset to realtime.
 * @param onCustomTimeSet - Called with the selected date when submitted.
 */
export function TimeSettingDialog({
  initialTime,
  isCustomTime,
  open,
  onOpenChange,
  onResetToNow,
  onCustomTimeSet,
}: TimeSettingDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (node) {
        node.value = toDatetimeLocalValue(initialTime);
      }
    },
    [initialTime],
  );

  const handleSubmit = useCallback(() => {
    if (inputRef.current?.value) {
      onCustomTimeSet(new Date(inputRef.current.value));
    }
    onOpenChange(false);
  }, [onCustomTimeSet, onOpenChange]);

  const handleResetToNowAndClose = useCallback(() => {
    onResetToNow();
    onOpenChange(false);
  }, [onResetToNow, onOpenChange]);

  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[10dvh] w-[calc(100%-48px)] max-w-sm translate-y-0 gap-3 overflow-hidden rounded-xl"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('timeSettingTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('timeSettingDescription')}</DialogDescription>
        </DialogHeader>
        {isCustomTime && (
          <Alert className="border-amber-200 bg-amber-50 py-2 dark:border-amber-800 dark:bg-amber-950/50">
            <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {t('timeFrozen')}
            </AlertTitle>
          </Alert>
        )}
        <label htmlFor="custom-datetime" className="sr-only">
          Date and time
        </label>
        <input
          id="custom-datetime"
          ref={setInputRef}
          type="datetime-local"
          className="border-input bg-background w-full max-w-full min-w-0 rounded-lg border px-3 py-2.5 text-base"
        />
        <div className="flex justify-end gap-2">
          <Button
            size="lg"
            className="mr-auto border-2 border-emerald-500 bg-emerald-200 text-emerald-900 hover:bg-emerald-300 disabled:opacity-40"
            disabled={!isCustomTime}
            onClick={handleResetToNowAndClose}
          >
            {t('timeNow')}
          </Button>
          <Button
            size="lg"
            className="border-2 border-blue-500 bg-blue-200 text-blue-900 hover:bg-blue-300"
            onClick={handleSubmit}
          >
            {t('timeSet')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
