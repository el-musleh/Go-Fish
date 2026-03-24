import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useRef } from 'react';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export default function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  isDestructive = false,
  isLoading = false,
}: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    // Block dismiss (overlay click / Escape) while a request is in-flight
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isLoading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="gf-dialog-overlay" />
        <Dialog.Content
          className="gf-dialog"
          // WAI-ARIA: alertdialog interrupts workflow and requires immediate response
          role={isDestructive ? 'alertdialog' : 'dialog'}
          // Signal to AT that the content is being updated during loading
          aria-busy={isLoading ? 'true' : undefined}
          onOpenAutoFocus={(e) => {
            // For destructive actions, land focus on Cancel so Enter/Space
            // doesn't accidentally confirm a destructive operation
            if (isDestructive) {
              e.preventDefault();
              cancelRef.current?.focus();
            }
          }}
        >
          <Dialog.Title className="gf-card-title">{title}</Dialog.Title>
          <Dialog.Description className="gf-muted" style={{ marginBottom: '24px' }}>
            {description}
          </Dialog.Description>

          <div className="gf-actions" style={{ justifyContent: 'flex-end' }}>
            <button
              ref={cancelRef}
              type="button"
              className="gf-button gf-button--secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={clsx('gf-button', {
                'gf-button--danger': isDestructive,
                'gf-button--primary': !isDestructive,
              })}
              onClick={onConfirm}
              disabled={isLoading}
              // Override accessible name while loading — spinner has no visible text
              aria-label={isLoading ? 'Processing, please wait' : undefined}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              ) : (
                confirmText
              )}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="gf-dialog__close"
              aria-label="Close dialog"
              // Prevent dismiss while loading — pointer-events also blocked via CSS opacity
              disabled={isLoading}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
