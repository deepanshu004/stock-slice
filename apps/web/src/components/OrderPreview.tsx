import { ArrowLeftRight, Check, ChevronDown, Clock3, ShieldCheck } from "lucide-react";
import type { Order } from "../types";
import { currency, formatDate } from "../utils/format";

export function OrderPreview({ order, precision }: { order: Order | null; precision: number }) {
  const scheduled = order?.status === "SCHEDULED";
  return <section className="panel allocation-panel">
    <div className="panel-heading"><div><div className="section-index">ORDER RESULT</div><h2>Allocation breakdown</h2></div><span className="currency-badge">USD <ChevronDown size={13} /></span></div>
    {order ? <>
      <div className="result-summary"><div><span className="result-label">{order.type === "BUY" ? "ORDER AMOUNT" : "SALE PROCEEDS"}</span><b>{currency.format(order.amount)}</b></div><span className={`order-type-tag ${order.type.toLowerCase()}`}>{order.type}</span></div>
      <div className="allocation-bar" aria-label="Order allocation chart">{order.allocations.map((allocation, index) => <span key={allocation.symbol} className={`allocation-segment segment-${index % 4}`} style={{ width: `${allocation.allocationPercent}%` }} title={`${allocation.symbol} ${allocation.allocationPercent}%`} />)}</div>
      <div className="result-table">
        <div className="result-table-head"><span>ASSET</span><span>{order.type === "BUY" ? "ALLOCATED" : "PROCEEDS"}</span><span>SHARES</span></div>
        {order.allocations.map((allocation, index) => <div className="result-row" key={allocation.symbol}><div className="result-asset"><span className={`ticker-icon ticker-${index % 4}`}>{allocation.symbol.slice(0, 1)}</span><span><b>{allocation.symbol}</b><small>{allocation.allocationPercent}% · {currency.format(allocation.price)} / share</small></span></div><span className="result-money">{currency.format(allocation.amount)}</span><span className="result-shares">{allocation.shares.toFixed(precision)}</span></div>)}
      </div>
      <div className="execution-card" role="group" aria-label={scheduled ? "Execution schedule" : "Demo execution"}><div className="execution-icon">{scheduled ? <Clock3 size={17} /> : <Check size={17} />}</div><div><span className="result-label">{scheduled ? "EXECUTION SCHEDULE" : "DEMO EXECUTION"}</span><b>{formatDate(order.executionAt, { timeZone: order.executionTimezone, weekday: "long", month: "short", day: "numeric" })}</b><small>{formatDate(order.executionAt, { timeZone: order.executionTimezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · {scheduled ? "Next market open" : "Completed in your demo account"}</small></div><span className="schedule-tag">{order.status}</span></div>
      <div className="calculation-footnote"><ShieldCheck size={14} />{scheduled ? "Demo balances update on placement." : "Demo trade completed."} No orders are sent to a broker.</div>
    </> : <div className="empty-preview"><div className="empty-chart"><div className="empty-chart-inner"><ArrowLeftRight size={22} /></div></div><h3>Your order, at a glance.</h3><p>Buy a model portfolio or choose owned stocks to sell. Your order and execution schedule will appear here.</p><div className="preview-hint"><span>DEMO</span><b>Next market open</b><i>simulated trades</i></div></div>}
  </section>;
}
