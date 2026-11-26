import { useRef } from "react";
import { ArrowDownToLine, ArrowUpRight, CalendarDays, ShieldCheck } from "lucide-react";
import type { TradingDesk } from "../hooks/useTradingDesk";
import { currency } from "../utils/format";
import { BuyPortfolioFields } from "./BuyPortfolioFields";
import { SellHoldings } from "./SellHoldings";

export function TradeForm({ desk }: { desk: TradingDesk }) {
  const { type, config, busy, submitting, wallet } = desk;
  const dateInputRef = useRef<HTMLInputElement>(null);
  return <section className="panel order-panel">
    <div className="panel-heading"><div><div className="section-index">ORDER DETAILS</div><h2>Configure order</h2></div><span className="panel-step"><ShieldCheck size={15} />Demo trading</span></div>
    <form onSubmit={desk.handleSubmit}>
      <fieldset className="side-fieldset"><legend>Order side</legend><div className="side-switch">
        <button type="button" className={type === "BUY" ? "side-option selected buy" : "side-option"} aria-pressed={type === "BUY"} onClick={() => desk.changeSide("BUY")} disabled={busy}><ArrowUpRight size={16} />BUY</button>
        <button type="button" className={type === "SELL" ? "side-option selected sell" : "side-option"} aria-pressed={type === "SELL"} onClick={() => desk.changeSide("SELL")} disabled={busy}><ArrowDownToLine size={16} />SELL</button>
      </div></fieldset>
      <div className="test-date-field">
        <div className="test-date-heading"><label htmlFor="test-order-date">Test order date (New York)</label><span>Optional</span></div>
        <div className="test-date-controls"><div className="input-wrap"><CalendarDays size={16} /><input id="test-order-date" ref={dateInputRef} type="date" value={desk.simulationDate} onChange={(event) => desk.changeSimulationDate(event.target.value)} aria-describedby="test-order-date-help" disabled={busy} /></div>{desk.simulationDate && <button type="button" className="current-time-button" onClick={() => { desk.changeSimulationDate(""); dateInputRef.current?.focus(); }} disabled={busy}>Use current time</button>}</div>
        <p id="test-order-date-help">Choose a date to test an order at noon in New York. Leave blank to use the current time.</p>
      </div>
      {type === "BUY" ? <>
        <BuyPortfolioFields desk={desk} />
        <p className={desk.insufficientBalance ? "buy-balance-note insufficient-balance" : "buy-balance-note"} id="buy-wallet-help">{!wallet ? "Your wallet must be available before buying." : desk.insufficientBalance ? `Insufficient wallet balance. You have ${currency.format(wallet.balance)} available. Add money to your wallet before buying.` : `${currency.format(wallet.balance)} available in your demo wallet.`}</p>
      </> : <SellHoldings positions={desk.positions} quantities={desk.sellQuantities} precision={config?.sharePrecision ?? 3} proceeds={desk.sellProceeds} loading={desk.loading} ready={desk.positionsReady} disabled={busy} onQuantityChange={desk.updateSellQuantity} onStep={desk.stepSellQuantity} onBuy={() => desk.changeSide("BUY")} />}
      <div className="form-footer"><div className="precision-note"><span className="precision-symbol">ƒ</span><span>Share precision<span className="precision-value">{config ? config.sharePrecision : "—"} decimals</span></span></div><button className={`submit-button ${type === "SELL" ? "sell-submit" : ""}`} type="submit" disabled={!desk.canSubmit} aria-describedby={type === "BUY" ? "buy-wallet-help" : undefined}>{submitting ? <><span className="button-spinner" />{type === "BUY" ? "Buying…" : "Selling…"}</> : type === "BUY" ? "Buy" : "Sell"}</button></div>
    </form>
  </section>;
}
