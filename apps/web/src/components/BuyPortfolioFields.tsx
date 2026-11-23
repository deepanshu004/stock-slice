import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import type { TradingDesk } from "../hooks/useTradingDesk";
import { currency } from "../utils/format";

export function BuyPortfolioFields({ desk }: { desk: TradingDesk }) {
  const { holdings, allocationTotal, config, portfolios, portfolioName, amount, busy } = desk;
  return <>
    <div className="field-row first-fields">
      <label className="field" id="portfolio"><span>Portfolio name</span><div className="input-wrap"><BriefcaseBusiness size={16} /><input aria-label="Portfolio name" value={portfolioName} onChange={(event) => desk.setPortfolioName(event.target.value)} maxLength={80} required disabled={busy} /></div>{portfolios.length > 0 && <select className="saved-portfolio-select" aria-label="Load saved portfolio" defaultValue="" onChange={(event) => desk.loadPortfolio(event.target.value)} disabled={busy}><option value="">Load saved portfolio…</option>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select>}</label>
      <label className="field"><span>Investment amount</span><div className="input-wrap amount-wrap"><span className="currency-sign">$</span><input aria-label="Investment amount" type="number" min="0.01" max="1000000000" step="0.01" value={amount} onChange={(event) => desk.setAmount(event.target.value)} required disabled={busy} /><span className="currency-unit">USD</span></div></label>
    </div>
    <div className="holdings-heading buy-holdings-heading"><div><div className="section-index">MODEL PORTFOLIO</div><h3>Holdings <span>{holdings.length}</span></h3></div><div className={Math.abs(allocationTotal - 100) < 0.0001 ? "allocation-total balanced" : "allocation-total"}><span className="allocation-rail"><i style={{ width: `${Math.max(0, Math.min(allocationTotal, 100))}%` }} /></span><b>{allocationTotal}%</b><small>/ 100%</small></div></div>
    <div className="holdings-table">
      <div className="holdings-table-head"><span>ASSET</span><span>WEIGHT</span><span>MARKET PRICE <small>OPTIONAL</small></span><span /></div>
      {holdings.map((holding, index) => <div className="holding-row" key={`holding-${index}`}>
        <label className="asset-cell"><span className={`ticker-icon ticker-${index % 4}`}>{holding.symbol.trim().slice(0, 1).toUpperCase() || "·"}</span><input aria-label={`Symbol ${index + 1}`} value={holding.symbol} onChange={(event) => desk.updateHolding(index, { symbol: event.target.value })} maxLength={12} placeholder="AAPL" required disabled={busy} /></label>
        <label className="weight-input"><input aria-label={`Allocation ${index + 1}`} type="number" min="0.01" max="100" step="0.01" value={holding.allocationPercent} onChange={(event) => desk.updateHolding(index, { allocationPercent: event.target.value })} required disabled={busy} /><span>%</span></label>
        <label className="price-input"><span>$</span><input aria-label={`Market price ${index + 1}`} type="number" min="0.01" max="1000000" step="0.01" value={holding.marketPrice} onChange={(event) => desk.updateHolding(index, { marketPrice: event.target.value })} placeholder={config ? currency.format(config.defaultPrice).replace("$", "") : "100.00"} disabled={busy} /><span className="price-source">{holding.marketPrice ? "PARTNER" : "DEFAULT"}</span></label>
        <button className="remove-holding" type="button" aria-label={`Remove ${holding.symbol || "holding"}`} title="Remove holding" disabled={busy || holdings.length <= 1} onClick={() => desk.removeHolding(index)}><Trash2 size={15} /></button>
      </div>)}
    </div>
    <div className="holding-actions"><div className="holding-action-buttons"><button className="add-holding" type="button" onClick={desk.addHolding} disabled={busy || holdings.length >= 50}><Plus size={15} />Add holding</button><button className="save-portfolio" type="button" onClick={desk.handleSavePortfolio} disabled={busy || desk.savingPortfolio}><BriefcaseBusiness size={13} />{desk.savingPortfolio ? "Saving…" : "Save portfolio"}</button></div><span>Allocations must total 100%</span></div>
  </>;
}
