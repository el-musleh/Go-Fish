import { Toaster as SonnerToaster } from 'sonner';

// Re-export the toast function so it can be imported from a single module
// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--bg-surface)',
          color: 'var(--text)',
          border: '1px solid var(--line)',
          fontFamily: 'var(--font-sans)',
        },
        // Class names for specific toast types
        className: 'gf-toast',
        error: {
          className: 'gf-toast--error',
        },
        success: {
          className: 'gf-toast--success',
        },
      }}
    />
  );
}
