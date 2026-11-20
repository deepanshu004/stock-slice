import { useEffect, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpRight, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleAlert, Clock3, Plus, RefreshCw,
  Settings2, ShieldCheck, Trash2, TrendingUp, Wallet,
} from "lucide-react";
import { fetchConfig, fetchOrders, fetchPortfolios, savePortfolio, submitOrder } from "./api";
import type { ApiConfig, HoldingInput, Order, OrderType, Portfolio } from "./types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const initialHoldings: HoldingInput[] = [
  { symbol: "AAPL", allocationPercent: "60", marketPrice: "" },
  { symbol: "TSLA", allocationPercent: "40", marketPrice: "" },
];

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(new Date(value));
}

function App() {
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioName, setPortfolioName] = useState("Core growth");
  const [amount, setAmount] = useState("1000");
  const [type, setType] = useState<OrderType>("BUY");
  const [holdings, setHoldings] = useState(initialHoldings);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchConfig(), fetchOrders(), fetchPortfolios()]).then(([configResult, ordersResult, portfoliosResult]) => {
      if (!active) return;
      if (configResult.status === "fulfilled") setConfig(configResult.value);
      else setError(configResult.reason instanceof Error ? configResult.reason.message : "Unable to load order service.");
      if (ordersResult.status === "fulfilled") setOrders(ordersResult.value);
      else if (configResult.status === "fulfilled") setError(ordersResult.reason instanceof Error ? ordersResult.reason.message : "Unable to load order history.");
      if (portfoliosResult.status === "fulfilled") setPortfolios(portfoliosResult.value);
      else if (configResult.status === "fulfilled" && ordersResult.status === "fulfilled") setError(portfoliosResult.reason instanceof Error ? portfoliosResult.reason.message : "Unable to load portfolios.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const allocationTotal = holdings.reduce((sum, holding) => sum + (Number(holding.allocationPercent) || 0), 0);
  const investedTotal = orders.reduce((sum, order) => sum + order.amount, 0);

  function updateHolding(index: number, patch: Partial<HoldingInput>) {
    setHoldings((current) => current.map((holding, row) => row === index ? { ...holding, ...patch } : holding));
    setLastOrder(null);
    setNotice("");
  }

  async function refreshHistory() {
    setHistoryLoading(true);
    try {
      setOrders(await fetchOrders());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSavePortfolio() {
    setError("");
    setNotice("");
    if (Math.abs(allocationTotal - 100) > 0.0001 || holdings.some((holding) => !holding.symbol.trim() || Number(holding.allocationPercent) <= 0)) {
      setError("Add a symbol to every holding and make sure allocations total exactly 100%.");
      return;
    }
    try {
      const saved = await savePortfolio({
        name: portfolioName.trim() || "Untitled portfolio",
        holdings: holdings.map((holding) => ({
          symbol: holding.symbol.trim(),
          allocationPercent: Number(holding.allocationPercent),
          ...(holding.marketPrice.trim() ? { marketPrice: Number(holding.marketPrice) } : {}),
        })),
      });
      setPortfolios((current) => [saved, ...current]);
      setNotice("Portfolio saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save portfolio.");
    }
  }

  function loadPortfolio(id: string) {
    const saved = portfolios.find((portfolio) => portfolio.id === id);
    if (!saved) return;
    setPortfolioName(saved.name);
    setHoldings(saved.holdings.map((holding) => ({
      symbol: holding.symbol,
      allocationPercent: String(holding.allocationPercent),
      marketPrice: holding.marketPrice === undefined ? "" : String(holding.marketPrice),
    })));
    setLastOrder(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (Math.abs(allocationTotal - 100) > 0.0001) {
      setError(`Portfolio allocations currently total ${allocationTotal}%. Adjust them to exactly 100%.`);
      return;
    }
    if (holdings.some((holding) => !holding.symbol.trim() || Number(holding.allocationPercent) <= 0)) {
      setError("Each holding needs a symbol and an allocation greater than 0%.");
      return;
    }

    setSubmitting(true);
    try {
      const order = await submitOrder({
        type,
        amount: Number(amount),
        portfolio: {
          name: portfolioName.trim() || "Untitled portfolio",
          holdings: holdings.map((holding) => ({
            symbol: holding.symbol.trim(),
            allocationPercent: Number(holding.allocationPercent),
            ...(holding.marketPrice.trim() ? { marketPrice: Number(holding.marketPrice) } : {}),
          })),
        },
      });
      setLastOrder(order);
      setNotice("Order created");
      await refreshHistory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Stock Slice home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>stock<span className="brand-light">slice</span></span>
        </a>
        <div className="workspace-switch"><span className="workspace-icon">N</span><span className="workspace-copy"><b>Northstar Capital</b><small>Investment workspace</small></span><ChevronDown size={15} /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#order-desk"><ArrowLeftRight size={17} />Order desk<span className="nav-indicator" /></a>
          <a className="nav-link" href="#history"><Clock3 size={17} />Order history</a>
          <a className="nav-link" href="#portfolio"><BriefcaseBusiness size={17} />Portfolios</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="service-card"><span className="service-dot" /><span><b>Order service</b><small>{loading ? "Connecting…" : config ? "Operational" : "Unavailable"}</small></span><Activity size={17} /></div>
          <a className="nav-link settings-link" href="#settings"><Settings2 size={17} />Settings</a>
          <div className="profile-row"><div className="avatar">JM</div><span className="profile-copy"><b>Jordan Miller</b><small>Portfolio manager</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-content" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>Order desk</b></div>
          <div className="topbar-right"><span className="market-status"><i />US market schedule</span><span className="topbar-divider" /><span className="today-label">{formatDate(new Date().toISOString(), { weekday: "short", month: "short", day: "numeric" })}</span><button className="icon-button" type="button" title="Refresh order history" onClick={refreshHistory} disabled={historyLoading}><RefreshCw size={17} className={historyLoading ? "spin" : ""} /></button></div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-rule" />TRADE OPERATIONS</div><h1>Order desk</h1><p>Build a portfolio order. We’ll take care of the allocation math.</p></div>
            <div className="heading-meta"><span className={config ? "live-dot" : "offline-dot"} />{config ? "Connected to API" : "API unavailable"}<span className="meta-divider" />USD</div>
          </section>

          {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
          {notice && <div className="alert alert-success" role="status"><Check size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

          <section className="metric-strip" aria-label="Order desk summary">
            <div className="metric"><div className="metric-label">ORDERS THIS SESSION <span className="metric-icon"><ArrowLeftRight size={15} /></span></div><div className="metric-value">{orders.length.toString().padStart(2, "0")}<span className="metric-note">orders</span></div><div className="metric-foot"><span className="metric-accent">In-memory session</span><span>resets on restart</span></div></div>
            <div className="metric"><div className="metric-label">TOTAL ORDER VALUE <span className="metric-icon"><Wallet size={15} /></span></div><div className="metric-value">{currency.format(investedTotal)}</div><div className="metric-foot"><span className="metric-accent">Across all orders</span><span>USD</span></div></div>
            <div className="metric"><div className="metric-label">MARKET SCHEDULE <span className="metric-icon"><CalendarDays size={15} /></span></div><div className="metric-value metric-regular">Weekdays<span className="metric-note">only</span></div><div className="metric-foot"><span className="market-mini"><i />NYSE schedule</span><span>09:30 ET</span></div></div>
          </section>

          <div className="work-grid" id="order-desk">
            <section className="panel order-panel">
              <div className="panel-heading"><div><div className="section-index">01 <span>·</span> ORDER DETAILS</div><h2>Configure order</h2></div><span className="panel-step"><ShieldCheck size={15} />Secure request</span></div>
              <form onSubmit={handleSubmit}>
                <div className="field-row first-fields">
                  <label className="field" id="portfolio"><span>Portfolio name</span><div className="input-wrap"><BriefcaseBusiness size={16} /><input value={portfolioName} onChange={(event) => setPortfolioName(event.target.value)} maxLength={80} required /></div>{portfolios.length > 0 && <select className="saved-portfolio-select" aria-label="Load saved portfolio" defaultValue="" onChange={(event) => loadPortfolio(event.target.value)}><option value="">Load saved portfolio…</option>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select>}</label>
                  <label className="field"><span>Investment amount</span><div className="input-wrap amount-wrap"><span className="currency-sign">$</span><input aria-label="Investment amount" type="number" min="0.01" max="1000000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /><span className="currency-unit">USD</span></div></label>
                </div>
                <fieldset className="side-fieldset"><legend>Order side</legend><div className="side-switch">
                  <button type="button" className={type === "BUY" ? "side-option selected buy" : "side-option"} onClick={() => { setType("BUY"); setLastOrder(null); }}><ArrowUpRight size={16} />BUY</button>
                  <button type="button" className={type === "SELL" ? "side-option selected sell" : "side-option"} onClick={() => { setType("SELL"); setLastOrder(null); }}><ArrowDownToLine size={16} />SELL</button>
                </div></fieldset>

                <div className="holdings-heading"><div><div className="section-index">02 <span>·</span> MODEL PORTFOLIO</div><h3>Holdings <span>{holdings.length}</span></h3></div><div className={Math.abs(allocationTotal - 100) < 0.0001 ? "allocation-total balanced" : "allocation-total"}><span className="allocation-rail"><i style={{ width: `${Math.min(allocationTotal, 100)}%` }} /></span><b>{allocationTotal}%</b><small>/ 100%</small></div></div>

                <div className="holdings-table">
                  <div className="holdings-table-head"><span>ASSET</span><span>WEIGHT</span><span>MARKET PRICE <small>OPTIONAL</small></span><span /></div>
                  {holdings.map((holding, index) => <div className="holding-row" key={`holding-${index}`}>
                    <label className="asset-cell"><span className={`ticker-icon ticker-${index % 4}`}>{holding.symbol.trim().slice(0, 1).toUpperCase() || "·"}</span><input aria-label={`Symbol ${index + 1}`} value={holding.symbol} onChange={(event) => updateHolding(index, { symbol: event.target.value })} maxLength={12} placeholder="AAPL" required /></label>
                    <label className="weight-input"><input aria-label={`Allocation ${index + 1}`} type="number" min="0.01" max="100" step="0.01" value={holding.allocationPercent} onChange={(event) => updateHolding(index, { allocationPercent: event.target.value })} required /><span>%</span></label>
                    <label className="price-input"><span>$</span><input aria-label={`Market price ${index + 1}`} type="number" min="0.01" max="1000000" step="0.01" value={holding.marketPrice} onChange={(event) => updateHolding(index, { marketPrice: event.target.value })} placeholder={config ? currency.format(config.defaultPrice).replace("$", "") : "100.00"} /><span className="price-source">{holding.marketPrice ? "PARTNER" : "DEFAULT"}</span></label>
                    <button className="remove-holding" type="button" aria-label={`Remove ${holding.symbol || "holding"}`} title="Remove holding" disabled={holdings.length <= 1} onClick={() => { setHoldings((current) => current.filter((_, row) => row !== index)); setLastOrder(null); }}><Trash2 size={15} /></button>
                  </div>)}
                </div>
                <div className="holding-actions"><div className="holding-action-buttons"><button className="add-holding" type="button" onClick={() => { setHoldings((current) => [...current, { symbol: "", allocationPercent: "1", marketPrice: "" }]); setLastOrder(null); }}><Plus size={15} />Add holding</button><button className="save-portfolio" type="button" onClick={handleSavePortfolio} disabled={loading}><BriefcaseBusiness size={13} />Save portfolio</button></div><span>Allocations must total 100%</span></div>

                <div className="form-footer"><div className="precision-note"><span className="precision-symbol">ƒ</span><span>Share precision<span className="precision-value">{config ? config.sharePrecision : "—"} decimals</span></span></div><button className="submit-button" type="submit" disabled={loading || submitting || !config}>{submitting ? <><span className="button-spinner" />Calculating…</> : <>Calculate order <ArrowUpRight size={17} /></>}</button></div>
              </form>
            </section>

            <section className="panel allocation-panel">
              <div className="panel-heading"><div><div className="section-index">03 <span>·</span> ORDER PREVIEW</div><h2>Allocation breakdown</h2></div><span className="currency-badge">USD <ChevronDown size={13} /></span></div>
              {lastOrder ? <>
                <div className="result-summary"><div><span className="result-label">ORDER AMOUNT</span><b>{currency.format(lastOrder.amount)}</b></div><span className={`order-type-tag ${lastOrder.type.toLowerCase()}`}>{lastOrder.type}</span></div>
                <div className="allocation-bar" aria-label="Order allocation chart">{lastOrder.allocations.map((allocation, index) => <span key={allocation.symbol} className={`allocation-segment segment-${index % 4}`} style={{ width: `${allocation.allocationPercent}%` }} title={`${allocation.symbol} ${allocation.allocationPercent}%`} />)}</div>
                <div className="result-table">
                  <div className="result-table-head"><span>ASSET</span><span>ALLOCATED</span><span>SHARES</span></div>
                  {lastOrder.allocations.map((allocation, index) => <div className="result-row" key={allocation.symbol}><div className="result-asset"><span className={`ticker-icon ticker-${index % 4}`}>{allocation.symbol.slice(0, 1)}</span><span><b>{allocation.symbol}</b><small>{allocation.allocationPercent}% · {currency.format(allocation.price)} / share</small></span></div><span className="result-money">{currency.format(allocation.amount)}</span><span className="result-shares">{allocation.shares.toFixed(config?.sharePrecision ?? 3)}</span></div>)}
                </div>
                <div className="execution-card"><div className="execution-icon"><CalendarDays size={17} /></div><div><span className="result-label">SCHEDULED EXECUTION</span><b>{formatDate(lastOrder.executionAt, { weekday: "long", month: "short", day: "numeric" })}</b><small>{formatDate(lastOrder.executionAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · Next weekday market open</small></div><span className="schedule-tag">SCHEDULED</span></div>
                <div className="calculation-footnote"><ShieldCheck size={14} />Share quantities rounded down to {config?.sharePrecision} decimal places. No trades are executed.</div>
              </> : <div className="empty-preview"><div className="empty-chart"><div className="empty-chart-inner"><ArrowLeftRight size={22} /></div></div><h3>Your order, at a glance.</h3><p>Configure a portfolio and calculate an order to see its allocation, share quantity and execution schedule.</p><div className="preview-hint"><span>MARKET</span><b>Fixed at $100</b><i>or partner price</i></div></div>}
            </section>
          </div>

          <section className="panel history-panel" id="history">
            <div className="panel-heading history-heading"><div><div className="section-index">04 <span>·</span> ACTIVITY</div><h2>Recent orders <span className="history-count">{orders.length}</span></h2></div><button className="history-refresh" type="button" onClick={refreshHistory} disabled={historyLoading}>{historyLoading ? <span className="button-spinner dark" /> : <RefreshCw size={14} />}Refresh</button></div>
            {orders.length === 0 ? <div className="history-empty"><span><Clock3 size={17} /></span><div><b>No orders yet</b><small>Your orders will appear here after you calculate and submit one.</small></div></div> : <div className="history-table">
              <div className="history-table-head"><span>ORDER</span><span>PORTFOLIO</span><span>AMOUNT</span><span>HOLDINGS</span><span>EXECUTION</span><span>CREATED</span><span>STATUS</span></div>
              {orders.map((order) => <button className="history-row" type="button" key={order.id} onClick={() => { setLastOrder(order); setNotice(""); }}>
                <span className="history-order-id"><span className={`history-type ${order.type.toLowerCase()}`}>{order.type === "BUY" ? <ArrowUpRight size={13} /> : <ArrowDownToLine size={13} />}</span><span><b>{order.id.slice(0, 8).toUpperCase()}</b><small>{order.type} order</small></span></span>
                <span className="history-portfolio">{order.portfolioName}</span><b className="history-amount">{currency.format(order.amount)}</b>
                <span className="holding-stack">{order.allocations.slice(0, 3).map((allocation) => <i key={allocation.symbol}>{allocation.symbol.slice(0, 1)}</i>)}<small>{order.allocations.length} assets</small></span>
                <span className="history-date">{formatDate(order.executionAt, { month: "short", day: "numeric" })}<small>{formatDate(order.executionAt, { hour: "numeric", minute: "2-digit" })} ET</small></span>
                <span className="history-date">{formatDate(order.createdAt, { month: "short", day: "numeric" })}<small>{formatDate(order.createdAt, { hour: "numeric", minute: "2-digit" })} ET</small></span>
                <span className="history-status"><i />Scheduled</span>
              </button>)}
            </div>}
          </section>

          <footer className="page-footer"><span><span className="footer-mark"><TrendingUp size={13} /></span>STOCK SLICE <span className="footer-dot">·</span> ORDER MANAGEMENT</span><span>Orders are simulated for allocation planning only. No trades are executed.</span><span className="footer-api"><i />API {config ? "CONNECTED" : "OFFLINE"}</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;