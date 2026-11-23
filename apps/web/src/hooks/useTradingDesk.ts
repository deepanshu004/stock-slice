import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  fetchConfig, fetchOrders, fetchPortfolios, fetchPositions, fetchWallet,
  savePortfolio, submitOrder, topUpWallet,
} from "../api";
import type { ApiConfig, HoldingInput, Order, OrderType, Portfolio, PortfolioInput, Position, Wallet } from "../types";
import { currency } from "../utils/format";

const initialHoldings: HoldingInput[] = [
  { symbol: "AAPL", allocationPercent: "60", marketPrice: "" },
  { symbol: "TSLA", allocationPercent: "40", marketPrice: "" },
];

function readSnapshot() {
  return Promise.allSettled([fetchConfig(), fetchOrders(), fetchPortfolios(), fetchWallet(), fetchPositions()]);
}

type DeskSnapshot = Awaited<ReturnType<typeof readSnapshot>>;

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export function useTradingDesk() {
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsReady, setPositionsReady] = useState(false);
  const [portfolioName, setPortfolioName] = useState("Core growth");
  const [amount, setAmount] = useState("1000");
  const [type, setType] = useState<OrderType>("BUY");
  const [holdings, setHoldings] = useState(initialHoldings);
  const [sellQuantities, setSellQuantities] = useState<Record<string, string>>({});
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPortfolio, setSavingPortfolio] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [topUpError, setTopUpError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submissionLock = useRef(false);
  const topUpLock = useRef(false);
  const saveLock = useRef(false);
  const refreshLock = useRef(false);

  const applySnapshot = useCallback((snapshot: DeskSnapshot): string => {
    const [configResult, ordersResult, portfoliosResult, walletResult, positionsResult] = snapshot;
    if (configResult.status === "fulfilled") setConfig(configResult.value);
    if (ordersResult.status === "fulfilled") setOrders(ordersResult.value);
    if (portfoliosResult.status === "fulfilled") setPortfolios(portfoliosResult.value);
    if (walletResult.status === "fulfilled") setWallet(walletResult.value);
    if (positionsResult.status === "fulfilled") {
      setPositions(positionsResult.value);
      setPositionsReady(true);
      setSellQuantities((current) => Object.fromEntries(positionsResult.value.map((position) => {
        const value = current[position.symbol] ?? "0";
        return [position.symbol, Number(value) > position.quantity ? String(position.quantity) : value];
      })));
    }
    const failed = snapshot.find((result) => result.status === "rejected");
    return failed?.status === "rejected" ? errorMessage(failed.reason, "Unable to load account data. Please refresh.") : "";
  }, []);

  useEffect(() => {
    let active = true;
    readSnapshot().then((snapshot) => {
      if (!active) return;
      setError(applySnapshot(snapshot));
      setLoading(false);
    });
    return () => { active = false; };
  }, [applySnapshot]);

  const refreshAccount = useCallback(async (): Promise<string> => {
    setRefreshing(true);
    try {
      return applySnapshot(await readSnapshot());
    } finally {
      setRefreshing(false);
    }
  }, [applySnapshot]);

  async function refresh() {
    if (refreshLock.current || submissionLock.current || topUpLock.current) return;
    refreshLock.current = true;
    setError("");
    try {
      setError(await refreshAccount());
    } finally {
      refreshLock.current = false;
    }
  }

  const allocationTotal = holdings.reduce((sum, holding) => sum + (Number(holding.allocationPercent) || 0), 0);
  const investedTotal = orders.reduce((sum, order) => sum + order.amount, 0);
  const selectedPositions = positions.flatMap((position) => {
    const quantity = Number(sellQuantities[position.symbol] ?? 0);
    return quantity > 0 ? [{ symbol: position.symbol, quantity }] : [];
  });
  const sellProceeds = positions.reduce((cents, position) => {
    const quantity = Number(sellQuantities[position.symbol] ?? 0);
    return cents + Math.round(quantity * position.price * 100);
  }, 0) / 100;
  const insufficientBalance = wallet !== null && Number(amount) > wallet.balance;
  const busy = loading || submitting || refreshing || toppingUp || savingPortfolio;
  const canSubmit = !busy && !!config && !!wallet && positionsReady && (type === "BUY"
    ? Number.isFinite(Number(amount)) && Number(amount) > 0 && !insufficientBalance
    : selectedPositions.length > 0);

  function resetResult() {
    setLastOrder(null);
    setNotice("");
  }

  function changeSide(side: OrderType) {
    setType(side);
    setError("");
    resetResult();
  }

  function updateHolding(index: number, patch: Partial<HoldingInput>) {
    setHoldings((current) => current.map((holding, row) => row === index ? { ...holding, ...patch } : holding));
    resetResult();
  }

  function addHolding() {
    setHoldings((current) => [...current, { symbol: "", allocationPercent: "1", marketPrice: "" }]);
    resetResult();
  }

  function removeHolding(index: number) {
    setHoldings((current) => current.filter((_, row) => row !== index));
    resetResult();
  }

  function updateSellQuantity(symbol: string, value: string) {
    const position = positions.find((owned) => owned.symbol === symbol);
    if (!position || !Number.isFinite(Number(value))) return;
    const bounded = Math.min(position.quantity, Math.max(0, Number(value)));
    setSellQuantities((current) => ({ ...current, [symbol]: value === "" ? "" : bounded === Number(value) ? value : String(bounded) }));
    resetResult();
  }

  function stepSellQuantity(symbol: string, direction: -1 | 1) {
    const quantity = Number(sellQuantities[symbol] ?? 0);
    updateSellQuantity(symbol, String(Number((quantity + direction).toFixed(10))));
  }

  function portfolioInput(): PortfolioInput {
    if (Math.abs(allocationTotal - 100) > 0.0001) {
      throw new Error(`Portfolio allocations currently total ${allocationTotal}%. Adjust them to exactly 100%.`);
    }
    if (holdings.some((holding) => !holding.symbol.trim() || !Number.isFinite(Number(holding.allocationPercent)) || Number(holding.allocationPercent) <= 0)) {
      throw new Error("Each holding needs a symbol and an allocation greater than 0%.");
    }
    return {
      name: portfolioName.trim() || "Untitled portfolio",
      holdings: holdings.map((holding) => ({
        symbol: holding.symbol.trim(),
        allocationPercent: Number(holding.allocationPercent),
        ...(holding.marketPrice.trim() ? { marketPrice: Number(holding.marketPrice) } : {}),
      })),
    };
  }

  async function handleSavePortfolio() {
    if (saveLock.current || busy) return;
    saveLock.current = true;
    setSavingPortfolio(true);
    setError("");
    setNotice("");
    try {
      const saved = await savePortfolio(portfolioInput());
      setPortfolios((current) => [saved, ...current]);
      setNotice("Portfolio saved");
    } catch (reason) {
      setError(errorMessage(reason, "Unable to save portfolio."));
    } finally {
      saveLock.current = false;
      setSavingPortfolio(false);
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
    resetResult();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || topUpLock.current || refreshLock.current || loading) return;
    submissionLock.current = true;
    setError("");
    setNotice("");
    try {
      if (!config || !wallet || !positionsReady) throw new Error("Load your wallet and stocks before placing an order.");
      const input = type === "BUY"
        ? { type: "BUY" as const, amount: Number(amount), portfolio: portfolioInput() }
        : { type: "SELL" as const, positions: selectedPositions };
      if (input.type === "BUY" && (!Number.isFinite(input.amount) || input.amount <= 0)) throw new Error("Enter an investment amount greater than zero.");
      if (input.type === "BUY" && input.amount > wallet.balance) throw new Error("Insufficient wallet balance. Add money before buying stocks.");
      if (input.type === "SELL" && !input.positions.length) throw new Error("Choose a quantity of stock to sell.");
      setSubmitting(true);
      const order = await submitOrder(input);
      setLastOrder(order);
      setOrders((current) => [order, ...current.filter(({ id }) => id !== order.id)]);
      setNotice(`${order.type === "BUY" ? "Buy" : "Sell"} order completed`);
      if (order.type === "SELL") setSellQuantities({});
      const refreshError = await refreshAccount();
      if (refreshError) setError(`Your order completed, but account data could not refresh. ${refreshError}`);
    } catch (reason) {
      setError(errorMessage(reason, "Unable to place order. Please try again."));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  function openTopUp() {
    setTopUpError("");
    setTopUpOpen(true);
  }

  function closeTopUp() {
    if (!topUpLock.current) setTopUpOpen(false);
  }

  async function handleTopUp(amountToAdd: number) {
    if (topUpLock.current || submissionLock.current || refreshLock.current) return;
    topUpLock.current = true;
    setToppingUp(true);
    setTopUpError("");
    try {
      if (!Number.isFinite(amountToAdd) || amountToAdd <= 0 || Math.abs(amountToAdd * 100 - Math.round(amountToAdd * 100)) >= 1e-7) {
        throw new Error("Enter an amount greater than zero with no more than two decimal places.");
      }
      setWallet(await topUpWallet(amountToAdd));
      setNotice(`${currency.format(amountToAdd)} added to your demo wallet`);
      setError("");
      setTopUpOpen(false);
    } catch (reason) {
      setTopUpError(errorMessage(reason, "Unable to add money. Please try again."));
    } finally {
      topUpLock.current = false;
      setToppingUp(false);
    }
  }

  return {
    config, orders, portfolios, wallet, positions, positionsReady, portfolioName, setPortfolioName,
    amount, setAmount, type, changeSide, holdings, lastOrder, setLastOrder, loading, submitting,
    refreshing, savingPortfolio, error, setError, notice, setNotice, allocationTotal, investedTotal,
    sellQuantities, selectedPositions, sellProceeds, insufficientBalance, busy, canSubmit,
    updateHolding, addHolding, removeHolding, updateSellQuantity, stepSellQuantity,
    refresh, handleSavePortfolio, loadPortfolio, handleSubmit,
    topUpOpen, toppingUp, topUpError, openTopUp, closeTopUp, handleTopUp,
  };
}

export type TradingDesk = ReturnType<typeof useTradingDesk>;
