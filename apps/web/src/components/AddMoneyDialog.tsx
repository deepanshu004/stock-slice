import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Wallet, X } from "lucide-react";

interface AddMoneyDialogProps {
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}

export function AddMoneyDialog({ pending, error, onClose, onSubmit }: AddMoneyDialogProps) {
  const [amount, setAmount] = useState("100");
  const dialogRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    amountRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (pending) dialogRef.current?.focus();
    else if (error) amountRef.current?.focus();
  }, [pending, error]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!pending) onClose();
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      dialogRef.current?.focus();
    } else if (document.activeElement === dialogRef.current) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !pending) onClose();
  }}>
    <div className="add-money-dialog" role="dialog" aria-modal="true" aria-labelledby="add-money-title" aria-describedby="add-money-description" tabIndex={-1} ref={dialogRef} onKeyDown={handleKeyDown}>
      <div className="dialog-heading"><span className="dialog-icon"><Wallet size={20} /></span><button type="button" className="dialog-close" aria-label="Close add money" disabled={pending} onClick={onClose}><X size={19} /></button></div>
      <h2 id="add-money-title">Add money</h2>
      <p id="add-money-description">Add demo funds to your wallet to buy stocks. This simulation does not charge a real card.</p>
      <form onSubmit={(event) => { event.preventDefault(); void onSubmit(Number(amount)); }}>
        <label className="dialog-amount-label" htmlFor="top-up-amount">Top-up amount</label>
        <div className="input-wrap dialog-amount"><span>$</span><input id="top-up-amount" ref={amountRef} type="number" min="0.01" max="1000000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={pending} /><span className="currency-unit">USD</span></div>
        <div className="demo-card"><CreditCard size={24} /><div><b>Demo card •••• 4242</b><span>Simulation only · No real card details needed</span></div><span className="demo-badge">DEMO</span></div>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button className="dialog-cancel" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className="submit-button" type="submit" disabled={pending || !Number.isFinite(Number(amount)) || Number(amount) <= 0}>{pending ? <><span className="button-spinner" />Adding…</> : "Add funds"}</button></div>
      </form>
    </div>
  </div>, document.body);
}
