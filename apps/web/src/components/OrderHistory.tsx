import { ArrowDownToLine, ArrowUpRight, Clock3, RefreshCw } from "lucide-react";
import type { Order } from "../types";
import { currency, formatDate } from "../utils/format";

interface OrderHistoryProps {
  orders: Order[];
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
  onSelect: (order: Order) => void;
}

export function OrderHistory({ orders, refreshing, disabled, onRefresh, onSelect }: OrderHistoryProps) {
  return <section className="panel history-panel" id="history">
    <div className="panel-heading history-heading"><div><div className="section-index">ACTIVITY</div><h2>Recent orders <span className="history-count">{orders.length}</span></h2></div><button className="history-refresh" type="button" onClick={onRefresh} disabled={disabled}>{refreshing ? <span className="button-spinner dark" /> : <RefreshCw size={14} />}Refresh</button></div>
    {orders.length === 0 ? <div className="history-empty"><span><Clock3 size={17} /></span><div><b>No orders yet</b><small>Your completed demo trades will appear here.</small></div></div> : <div className="history-table">
      <div className="history-table-head"><span>ORDER</span><span>PORTFOLIO</span><span>AMOUNT</span><span>HOLDINGS</span><span>EXECUTED</span><span>CREATED</span><span>STATUS</span></div>
      {orders.map((order) => <button className="history-row" type="button" key={order.id} onClick={() => onSelect(order)}>
        <span className="history-order-id"><span className={`history-type ${order.type.toLowerCase()}`}>{order.type === "BUY" ? <ArrowUpRight size={13} /> : <ArrowDownToLine size={13} />}</span><span><b>{order.id.slice(0, 8).toUpperCase()}</b><small>{order.type} order</small></span></span>
        <span className="history-portfolio">{order.portfolioName}</span><b className="history-amount">{currency.format(order.amount)}</b>
        <span className="holding-stack">{order.allocations.slice(0, 3).map((allocation) => <i key={allocation.symbol}>{allocation.symbol.slice(0, 1)}</i>)}<small>{order.allocations.length} assets</small></span>
        <span className="history-date">{formatDate(order.executionAt, { month: "short", day: "numeric" })}<small>{formatDate(order.executionAt, { hour: "numeric", minute: "2-digit" })} ET</small></span>
        <span className="history-date">{formatDate(order.createdAt, { month: "short", day: "numeric" })}<small>{formatDate(order.createdAt, { hour: "numeric", minute: "2-digit" })} ET</small></span>
        <span className="history-status"><i />Completed</span>
      </button>)}
    </div>}
  </section>;
}
