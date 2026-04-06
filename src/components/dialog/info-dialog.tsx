import ReactMarkdown, { type Components } from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { remarkAlert } from 'remark-github-blockquote-alert';
import remarkGfm from 'remark-gfm';

import aboutMarkdown from '../../../ABOUT.md?raw';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const markdownComponents: Components = {
  h1: ({ ...props }) => (
    <h1 className="text-foreground mb-4 text-center text-lg leading-snug font-bold" {...props} />
  ),
  h2: ({ ...props }) => (
    <h2
      className="text-foreground/80 mb-3 pt-3 text-center text-base leading-snug font-semibold"
      {...props}
    />
  ),
  h3: ({ ...props }) => (
    <h3 className="text-foreground mt-3 mb-2 text-sm leading-snug font-semibold" {...props} />
  ),
  p: ({ ...props }) => <p className="mb-3" {...props} />,
  ul: ({ ...props }) => <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ ...props }) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ ...props }) => (
    <a
      className="text-foreground underline underline-offset-2"
      rel="noreferrer"
      target="_blank"
      {...props}
    />
  ),
};

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal dialog showing webapp information.
 *
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called when the open state changes.
 */
export function InfoDialog({ open, onOpenChange }: InfoDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] max-w-120 flex-col gap-0 overflow-hidden">
        <DialogHeader className="border-border shrink-0 border-b pb-3 sm:text-center">
          <DialogTitle className="text-base">Where to Next?</DialogTitle>
          {`${__APP_VERSION__}`}
          <DialogDescription className="text-center sm:text-center">
            {t('info.status')}
          </DialogDescription>
        </DialogHeader>
        <div className="text-muted-foreground overflow-y-auto pt-3 text-sm leading-relaxed">
          <div>
            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm, remarkAlert]}>
              {aboutMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
