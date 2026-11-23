import { Plus, Wallet as WalletIcon } from "lucide-react";
import type { Wallet } from "../types";
import { currency } from "../utils/format";

interface WalletMetricProps {
  wallet: Wallet | null;
  loading: boolean;
  disabled: boolean;
  onAddMoney: () => void;
}

export function WalletMetric({ wallet, loading, disabled, onAddMoney }: WalletMetricProps) {
  return <div className="metric wallet-metric">
    <div className="metric-label">WALLET BALANCE <span className="metric-icon"><WalletIcon size={15} /></span></div>
    <div className="wallet-metric-main">
      <div className="metric-value" aria-label="Wallet balance">{wallet || loading ? currency.format(wallet?.balance ?? 0) : "Unavailable"}</div>
      <button className="add-money-button" type="button" onClick={onAddMoney} disabled={disabled || !wallet}><Plus size={13} />Add money</button>
    </div>
    <div className="metric-foot"><span className="metric-accent">Demo funds</span><span>No real payments</span></div>
  </div>;
}
