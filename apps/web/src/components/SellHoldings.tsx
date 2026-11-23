import { BriefcaseBusiness, Minus, Plus } from "lucide-react";
import type { Position } from "../types";
import { currency, formatQuantity } from "../utils/format";

interface SellHoldingsProps {
  positions: Position[];
  quantities: Record<string, string>;
  precision: number;
  proceeds: number;
  loading: boolean;
  ready: boolean;
  disabled: boolean;
  onQuantityChange: (symbol: string, value: string) => void;
  onStep: (symbol: string, direction: -1 | 1) => void;
  onBuy: () => void;
}

export function SellHoldings({ positions, quantities, precision, proceeds, loading, ready, disabled, onQuantityChange, onStep, onBuy }: SellHoldingsProps) {
  return <div className="sell-holdings">
    <div className="holdings-heading"><div><div className="section-index">OWNED POSITIONS</div><h3>Your stocks <span>{positions.length}</span></h3></div><span className="sell-quantity-caption">Choose shares to sell</span></div>
    {!ready ? <p className="positions-loading" role="status">{loading ? "Loading your stocks…" : "Unable to load your stocks. Refresh to try again."}</p>
      : positions.length === 0 ? <div className="positions-empty"><span className="positions-empty-icon"><BriefcaseBusiness size={24} /></span><h4>No stocks to sell yet</h4><p>Your purchased stocks will appear here. Buy stocks to build a position before selling.</p><button type="button" className="buy-stocks-button" onClick={onBuy} disabled={disabled}>Buy stocks</button></div>
      : <div className="positions-list">
        {positions.map((position, index) => {
          const value = quantities[position.symbol] ?? "0";
          const quantity = Number(value);
          return <div className="position-row" role="group" aria-label={position.symbol} key={position.symbol}>
            <div className="position-asset"><span className={`ticker-icon ticker-${index % 4}`}>{position.symbol.slice(0, 1)}</span><div><b>{position.symbol}</b><span>{formatQuantity(position.quantity)} owned</span></div></div>
            <div className="position-price"><b>{currency.format(position.price)}</b><span>Reference price / share</span></div>
            <div className="quantity-control"><button type="button" aria-label={`Decrease ${position.symbol} quantity`} onClick={() => onStep(position.symbol, -1)} disabled={disabled || quantity <= 0}><Minus size={14} /></button><input aria-label={`Sell quantity ${position.symbol}`} type="number" min="0" max={position.quantity} step={10 ** -precision} value={value} onChange={(event) => onQuantityChange(position.symbol, event.target.value)} disabled={disabled} /><button type="button" aria-label={`Increase ${position.symbol} quantity`} onClick={() => onStep(position.symbol, 1)} disabled={disabled || quantity >= position.quantity}><Plus size={14} /></button></div>
          </div>;
        })}
      </div>}
    <div className="sell-proceeds"><div><b>Estimated proceeds</b><span>Credited to your demo wallet after selling</span></div><output aria-label="Estimated proceeds">{currency.format(proceeds)}</output></div>
    <p className="sell-price-note">Sells use the reference price stored with each owned stock.</p>
  </div>;
}
