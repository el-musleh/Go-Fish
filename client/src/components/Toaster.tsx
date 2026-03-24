import { Toaster as SonnerToaster } from 'sonner';

// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      expand
      gap={10}
      toastOptions={{
        style: {
          background: 'var(--bg-surface)',
          color: 'var(--text)',
          border: '1px solid var(--line)',
          fontFamily: 'var(--font-sans)',
        },
        className: 'gf-toast',
      }}
    />
  );
}
