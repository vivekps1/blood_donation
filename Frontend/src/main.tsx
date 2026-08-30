import  { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Transient confirmations and failures that are not tied to a specific input.
        Inline banners and field errors handle everything a form can highlight. */}
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { maxWidth: '26rem' },
        success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
        error: { duration: 6000, iconTheme: { primary: '#dc2626', secondary: '#fff' } }
      }}
    >
      {/* Every toast carries a dismiss button, so a long error message can be cleared
          straight away instead of being waited out. Loading toasts are excluded: they
          are dismissed by the operation they are reporting on. */}
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {t.type !== 'loading' && (
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => toast.dismiss(t.id)}
                  style={{
                    marginLeft: '0.5rem',
                    alignSelf: 'flex-start',
                    border: 'none',
                    background: 'transparent',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    lineHeight: 1,
                    padding: '0.125rem 0.25rem'
                  }}
                >
                  &times;
                </button>
              )}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  </StrictMode>
);
 