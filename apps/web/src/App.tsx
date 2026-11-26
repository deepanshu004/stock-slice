import {
  ArrowLeftRight, Check, ChevronDown, CircleAlert,
  RefreshCw, TrendingUp, Wallet,
} from "lucide-react";
import { AddMoneyDialog } from "./components/AddMoneyDialog";
import { OrderHistory } from "./components/OrderHistory";
import { OrderPreview } from "./components/OrderPreview";
import { TradeForm } from "./components/TradeForm";
import { WalletMetric } from "./components/WalletMetric";
import { useTradingDesk } from "./hooks/useTradingDesk";
import { currency, formatDate } from "./utils/format";

function App() {
  const desk = useTradingDesk();
  const { config, loading, orders, refreshing, error, notice } = desk;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Stock Slice home">
          <span className="brand-mark"><span /><span /><span /></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#order-desk"><ArrowLeftRight size={17} />Order desk<span className="nav-indicator" /></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="avatar">JM</div><span className="profile-copy"><b>Jordan Miller</b><small>Portfolio manager</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-content" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>Order desk</b></div>
          <div className="topbar-right"><span className="market-status"><i />Demo account</span><span className="topbar-divider" /><span className="today-label">{formatDate(new Date().toISOString(), { weekday: "short", month: "short", day: "numeric" })}</span><button className="icon-button" type="button" title="Refresh wallet, stocks, and history" onClick={desk.refresh} disabled={desk.busy}><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button></div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-rule" />TRADE OPERATIONS</div><h1>Order desk</h1><p>Buy a portfolio or sell your stocks with demo funds.</p></div>
            <div className="heading-meta"><span className={config ? "live-dot" : "offline-dot"} />{config ? "Connected to API" : "API unavailable"}<span className="meta-divider" />USD</div>
          </section>

          {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => desk.setError("")} aria-label="Dismiss error">×</button></div>}
          {notice && <div className="alert alert-success" role="status"><Check size={18} /><span>{notice}</span><button type="button" onClick={() => desk.setNotice("")} aria-label="Dismiss message">×</button></div>}

          <section className="metric-strip" aria-label="Order desk summary">
            <div className="metric"><div className="metric-label">ORDERS THIS SESSION <span className="metric-icon"><ArrowLeftRight size={15} /></span></div><div className="metric-value">{orders.length.toString().padStart(2, "0")}<span className="metric-note">orders</span></div><div className="metric-foot"><span className="metric-accent">In-memory session</span><span>resets on restart</span></div></div>
            <div className="metric"><div className="metric-label">TOTAL ORDER VALUE <span className="metric-icon"><Wallet size={15} /></span></div><div className="metric-value">{currency.format(desk.investedTotal)}</div><div className="metric-foot"><span className="metric-accent">Across all orders</span><span>USD</span></div></div>
            <WalletMetric wallet={desk.wallet} loading={loading} disabled={desk.busy} onAddMoney={desk.openTopUp} />
          </section>

          <div className="work-grid" id="order-desk">
            <TradeForm desk={desk} />
            <OrderPreview order={desk.lastOrder} precision={config?.sharePrecision ?? 3} />
          </div>

          <OrderHistory orders={orders} refreshing={refreshing} disabled={desk.busy} onRefresh={desk.refresh} onSelect={(order) => { desk.setLastOrder(order); desk.setNotice(""); }} />

          <footer className="page-footer"><span><span className="footer-mark"><TrendingUp size={13} /></span>STOCK SLICE <span className="footer-dot">·</span> ORDER MANAGEMENT</span><span>Demo funds and simulated trades only. No real payments or broker orders.</span><span className="footer-api"><i />API {config ? "CONNECTED" : "OFFLINE"}</span></footer>
        </div>
      </main>

      {desk.topUpOpen && <AddMoneyDialog pending={desk.toppingUp} error={desk.topUpError} onClose={desk.closeTopUp} onSubmit={desk.handleTopUp} />}
    </div>
  );
}

export default App;
