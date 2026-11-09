import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// One modal for the whole app, used instead of the browser's window.confirm / alert popups.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Delete course?', message: '...', tone: 'danger', confirmText: 'Delete' }))) return;
//
// Options:
//   title        heading
//   message      text under the heading (new lines are kept)
//   details      optional list of short lines shown as bullets (for example what will be deleted)
//   tone         'primary' (default) | 'danger' | 'info'
//   confirmText  label of the main button
//   cancelText   label of the cancel button; pass null to show only one button (an "alert")
//   requireText  the person must type this word before the main button works (extra safety for big deletes)
// The promise resolves true when confirmed and false when cancelled, closed with Esc, or clicked outside.

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resolver.current?.(false); // a new question replaces an unanswered one
        resolver.current = resolve;
        setDlg(options);
      }),
    []
  );

  // Any leftover window.alert("...") in the app opens this window instead of the browser's plain popup.
  useEffect(() => {
    const native = window.alert;
    window.alert = (text) => { confirm({ title: 'Notice', message: String(text ?? ''), tone: 'info', confirmText: 'OK', cancelText: null }); };
    return () => { window.alert = native; };
  }, [confirm]);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDlg(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dlg && <ModalView dlg={dlg} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

const ICON = { danger: '⚠️', primary: '❓', info: 'ℹ️', success: '✅', error: '⛔' };

function ModalView({ dlg, onClose }) {
  const {
    title = 'Are you sure?',
    message = '',
    details = [],
    tone = 'primary',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    requireText = '',
  } = dlg;
  const [typed, setTyped] = useState('');
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const inputRef = useRef(null);

  const unlocked = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase();

  // Esc closes. The page behind the modal does not scroll while it is open.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Focus the safest control: the typing box, or Cancel for dangerous actions, or the main button.
  useEffect(() => {
    if (requireText) inputRef.current?.focus();
    else if (tone === 'danger' && cancelText !== null) cancelRef.current?.focus();
    else confirmRef.current?.focus();
  }, [requireText, tone, cancelText]);

  const submit = (e) => {
    e.preventDefault();
    if (unlocked) onClose(true);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onSubmit={submit}>
        <div className={`modal-icon ${tone}`}>{ICON[tone] || ICON.primary}</div>
        <h3 id="modal-title">{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        {details.length > 0 && (
          <ul className="modal-details">
            {details.map((d) => <li key={d}>{d}</li>)}
          </ul>
        )}
        {requireText && (
          <div className="modal-type">
            <label>Type <b>{requireText}</b> to confirm</label>
            <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        )}
        <div className="modal-actions">
          {cancelText !== null && (
            <button type="button" ref={cancelRef} className="btn btn-ghost" onClick={() => onClose(false)}>{cancelText}</button>
          )}
          <button ref={confirmRef} className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} disabled={!unlocked}>
            {confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}
