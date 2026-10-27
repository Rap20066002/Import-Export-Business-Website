"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import Link from "next/link";
import { RfqThread, type RfqThreadMessage } from "@/components/rfq-thread";
import { containerTypeLabel, isQuoteExpired } from "@/lib/trade";

type Props = { params: { locale: Locale } };

type RFQStatus = "SUBMITTED" | "UNDER_REVIEW" | "QUOTED" | "NEGOTIATION" | "CONVERTED_TO_ORDER" | "REJECTED";

type RFQ = {
  id: number;
  status: RFQStatus;
  createdAt: string;
  quantityContainers: number;
  containerType?: string;
  packagingKg?: number;
  numberOfBoxes?: number;
  incoterm: string;
  grade?: string | null;
  notes?: string | null;
  targetPricePerTon?: number | null;
  targetPriceCurrency?: string | null;
  buyer: { name: string; company?: string | null; email: string; phone?: string | null };
  items?: { product: { nameEn: string } }[];
  destinationPort?: { name: string; country?: { name: string } };
  quotations?: { id: number; pricePerTon: number; currency: string; validityDate?: string; notes?: string | null }[];
  companyDocumentKey?: string | null;
  messages?: RfqThreadMessage[];
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount?: number | null;
  currency?: string | null;
  estimatedWeightTons?: number | null;
  finalWeightTons?: number | null;
  invoicedAmount?: number | null;
  amountReceived?: number | null;
  settlementNote?: string | null;
  buyer?: { company?: string | null; name: string };
  statusHistory?: { status: string; createdAt: string; note?: string | null }[];
  payments?: { id: number; amount: number; note?: string | null; receivedAt: string }[];
  rfq?: { packagingKg: number; numberOfBoxes: number; containerType: string; quantityContainers: number } | null;
};

export default function AdminDashboard({ params }: Props) {
  const { user, token, loading } = useAuth();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quoteRfqId, setQuoteRfqId] = useState<number | null>(null);
  const [quotePricePerTon, setQuotePricePerTon] = useState<string>("");
  const [quoteCurrency, setQuoteCurrency] = useState<string>("USD");
  const [quoteValidityDate, setQuoteValidityDate] = useState<string>("");
  const [quoteNotes, setQuoteNotes] = useState<string>("");

  const [stageOrderId, setStageOrderId] = useState<number | null>(null);
  const [stageStatus, setStageStatus] = useState<string>("CONTAINER_BOOKING");
  const [stageNote, setStageNote] = useState<string>("");
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);
  const [settleOrderId, setSettleOrderId] = useState<number | null>(null);
  const [finalWeightTons, setFinalWeightTons] = useState("");
  const [settleUnitPrice, setSettleUnitPrice] = useState("");
  const [invoicedAmount, setInvoicedAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const refresh = useCallback(async () => {
    if (!token) return;
    const [rfqData, orderData] = await Promise.all([
      apiFetch<RFQ[]>("/rfqs", { token }),
      apiFetch<Order[]>("/orders", { token }),
    ]);
    setRfqs(rfqData);
    setOrders(orderData);
  }, [token]);

  const isAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "SALES_MANAGER" || user?.role === "LOGISTICS_MANAGER";

  useEffect(() => {
    if (!token || !isAdmin) return;
    refresh().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to load admin data.";
      setError(message);
    });
  }, [token, isAdmin, refresh]);

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Admin panel</h1>
        <p className="text-slate-600">
          Only internal users (Super Admin, Sales Manager, Logistics Manager) can access this view.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${params.locale}/admin/login`}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Go to admin login
          </Link>
          <Link
            href={`/${params.locale}/buyer/login`}
            className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            Buyer login
          </Link>
        </div>
      </div>
    );
  }

  const invoicedRevenue = orders.reduce((sum, o) => sum + (o.invoicedAmount || 0), 0);
  const receivedRevenue = orders.reduce((sum, o) => sum + (o.amountReceived || 0), 0);
  const outstandingRevenue = invoicedRevenue - receivedRevenue;

  const settleOrder = orders.find((o) => o.id === settleOrderId);

  const onSaveSettlement = async () => {
    if (!token || !settleOrderId) return;
    try {
      await apiFetch(`/orders/${settleOrderId}/settlement`, {
        method: "POST",
        token,
        body: {
          finalWeightTons: Number(finalWeightTons),
          unitPrice: settleUnitPrice ? Number(settleUnitPrice) : undefined,
          invoicedAmount: invoicedAmount ? Number(invoicedAmount) : undefined,
        },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settlement");
    }
  };

  const onRecordPayment = async () => {
    if (!token || !settleOrderId) return;
    try {
      await apiFetch(`/orders/${settleOrderId}/payments`, {
        method: "POST",
        token,
        body: { amount: Number(paymentAmount), note: paymentNote || undefined },
      });
      setPaymentAmount("");
      setPaymentNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const onSubmitQuote = async () => {
    if (!token || !quoteRfqId) return;
    try {
      await apiFetch(`/rfqs/${quoteRfqId}/quote`, {
        method: "POST",
        token,
        body: {
          pricePerTon: Number(quotePricePerTon),
          currency: quoteCurrency,
          validityDate: quoteValidityDate ? new Date(quoteValidityDate).toISOString() : undefined,
          notes: quoteNotes ? quoteNotes : undefined,
        },
      });
      setQuoteRfqId(null);
      setQuotePricePerTon("");
      setQuoteNotes("");
      setQuoteValidityDate("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send quotation");
    }
  };

  const onUpdateStage = async () => {
    if (!token || !stageOrderId) return;
    try {
      await apiFetch(`/orders/${stageOrderId}/status`, {
        method: "POST",
        token,
        body: { status: stageStatus, note: stageNote ? stageNote : undefined },
      });
      setStageOrderId(null);
      setStageNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order stage");
    }
  };

  const openCompanyDocument = async (rfqId: number) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/rfqs/${rfqId}/company-document/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to download company document");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `rfq-${rfqId}-company-document`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open company document");
    }
  };

  const onReviewRfq = async (rfqId: number, status: "UNDER_REVIEW" | "REJECTED") => {
    if (!token) return;
    const notes = status === "REJECTED" ? window.prompt("Optional note for the buyer") || undefined : undefined;
    try {
      await apiFetch(`/rfqs/${rfqId}/review`, {
        method: "POST",
        token,
        body: { status, notes },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update RFQ");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin panel</h1>
          <p className="text-slate-600">
            Monitor RFQs, convert to orders, update shipment stages and manage product SEO content.
          </p>
        </div>
        {user && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs">
              {user.name} · {user.role}
            </div>
            <Link
              href={`/${params.locale}/account`}
              className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Change password
            </Link>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total RFQs" value={rfqs.length} />
        <KpiCard label="Invoiced (final)" value={invoicedRevenue.toFixed(0)} suffix="USD" />
        <KpiCard label="Received" value={receivedRevenue.toFixed(0)} suffix="USD" />
        <KpiCard label="Outstanding" value={outstandingRevenue.toFixed(0)} suffix="USD" />
      </section>
      <p className="text-[11px] text-slate-500 -mt-4">
        Revenue is not taken from the buyer confirmation estimate. Fill final weight and invoice total on each
        order, then record each payment (advance, balance, etc.).
      </p>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">RFQs</h2>
          <div className="rounded-2xl border bg-white overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">RFQ</th>
                  <th className="px-3 py-2 text-left">Buyer</th>
                  <th className="px-3 py-2 text-left">Requirement</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Quote</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Doc</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      #{rfq.id}
                      <div className="text-[11px] font-normal text-slate-500">
                        {new Date(rfq.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <div>{rfq.buyer.company || rfq.buyer.name}</div>
                      <div className="text-[11px] text-slate-500">{rfq.buyer.email}</div>
                      {rfq.buyer.phone ? <div className="text-[11px] text-slate-500">{rfq.buyer.phone}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <div>{rfq.items?.map((item) => item.product.nameEn).join(", ") || "-"}</div>
                      <div className="text-[11px] text-slate-500">
                        {rfq.quantityContainers} × {containerTypeLabel(rfq.containerType)} · {rfq.incoterm}
                        {rfq.destinationPort
                          ? ` · ${rfq.destinationPort.name}${rfq.destinationPort.country ? `, ${rfq.destinationPort.country.name}` : ""}`
                          : ""}
                      </div>
                      {rfq.packagingKg && rfq.numberOfBoxes ? (
                        <div className="text-[11px] text-slate-500">
                          {rfq.numberOfBoxes} boxes × {rfq.packagingKg} kg
                          {" = "}
                          {((rfq.packagingKg * rfq.numberOfBoxes) / 1000).toFixed(3)} t est.
                        </div>
                      ) : null}
                      {rfq.targetPricePerTon ? (
                        <div className="text-[11px] text-slate-500">
                          Target: {rfq.targetPricePerTon} {rfq.targetPriceCurrency || "USD"} / t
                        </div>
                      ) : null}
                      {rfq.grade ? <div className="text-[11px] text-slate-500">Grade: {rfq.grade}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {rfq.status.replace(/_/g, " ")}
                      </span>
                      {rfq.status === "SUBMITTED" || rfq.status === "UNDER_REVIEW" ? (
                        <div className="mt-2 flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => onReviewRfq(rfq.id, "UNDER_REVIEW")}
                            className="text-[11px] text-slate-600 hover:underline text-left"
                          >
                            Mark reviewing
                          </button>
                          <button
                            type="button"
                            onClick={() => onReviewRfq(rfq.id, "REJECTED")}
                            className="text-[11px] text-red-600 hover:underline text-left"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {rfq.quotations?.length ? (
                        <div>
                          {rfq.quotations[0].pricePerTon.toFixed(2)} {rfq.quotations[0].currency}
                          {rfq.quotations[0].validityDate ? (
                            <div
                              className={`text-[11px] ${
                                isQuoteExpired(rfq.quotations[0].validityDate)
                                  ? "font-semibold text-red-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {isQuoteExpired(rfq.quotations[0].validityDate)
                                ? `Expired ${new Date(rfq.quotations[0].validityDate).toLocaleDateString()}`
                                : `Valid until ${new Date(rfq.quotations[0].validityDate).toLocaleDateString()}`}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {rfq.status !== "CONVERTED_TO_ORDER" && rfq.status !== "REJECTED" ? (
                        <button
                          type="button"
                          onClick={() => setQuoteRfqId(rfq.id)}
                          className="mt-1 inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                        >
                          {rfq.quotations?.length
                            ? isQuoteExpired(rfq.quotations[0].validityDate)
                              ? "Revise / extend"
                              : "Revise"
                            : "Quote"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpenThreadId(openThreadId === rfq.id ? null : rfq.id)}
                        className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                      >
                        {(rfq.messages?.length || 0) > 0 ? `${rfq.messages?.length} notes` : "Open"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {rfq.companyDocumentKey ? (
                        <button
                          type="button"
                          onClick={() => openCompanyDocument(rfq.id)}
                          className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                        >
                          Download
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {openThreadId ? (
            <RfqThread
              rfqId={openThreadId}
              token={token || ""}
              messages={rfqs.find((r) => r.id === openThreadId)?.messages || []}
              onPosted={refresh}
            />
          ) : null}

          {quoteRfqId && (
            <div className="rounded-2xl border bg-white p-4">
              <div className="font-semibold text-slate-900 mb-3">Send quotation for RFQ #{quoteRfqId}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price per ton</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={quotePricePerTon}
                    onChange={(e) => setQuotePricePerTon(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Currency</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={quoteCurrency}
                    onChange={(e) => setQuoteCurrency(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Validity date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                    value={quoteValidityDate}
                    onChange={(e) => setQuoteValidityDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes for buyer (shown in conversation)</label>
                  <textarea
                    className="w-full rounded-md border px-3 py-2 text-sm min-h-[72px]"
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Packing, payment terms, vessel window..."
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => onSubmitQuote()}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Send quotation
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteRfqId(null)}
                  className="inline-flex items-center justify-center rounded-full border px-5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Buyer</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Money</th>
                  <th className="px-3 py-2 text-left">Update</th>
                  <th className="px-3 py-2 text-left">Documents</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {order.orderNumber || `#${order.id}`}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {order.buyer?.company || order.buyer?.name || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {order.status.replace(/_/g, " ")}
                      </span>
                      {order.statusHistory?.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.note ? (
                        <div className="text-[11px] text-slate-500 mt-1">
                          {order.statusHistory.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <div>Inv: {order.invoicedAmount != null ? `${order.invoicedAmount.toFixed(0)} ${order.currency || "USD"}` : "—"}</div>
                      <div className="text-[11px] text-slate-500">
                        Recv: {(order.amountReceived || 0).toFixed(0)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStageOrderId(order.id);
                            setStageStatus(order.status);
                          }}
                          className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                        >
                          Stage
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSettleOrderId(order.id);
                            setFinalWeightTons(order.finalWeightTons ? String(order.finalWeightTons) : order.estimatedWeightTons ? String(order.estimatedWeightTons) : "");
                            setSettleUnitPrice("");
                            setInvoicedAmount(order.invoicedAmount != null ? String(order.invoicedAmount) : "");
                          }}
                          className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                        >
                          Settlement
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/${params.locale}/buyer/orders/${order.id}/documents`}
                        className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {settleOrderId && settleOrder && (
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <div className="font-semibold text-slate-900">Settlement · {settleOrder.orderNumber}</div>
              <p className="text-[11px] text-slate-500">
                RFQ estimate: {settleOrder.estimatedWeightTons != null ? `${settleOrder.estimatedWeightTons.toFixed(3)} t` : "n/a"}
                {settleOrder.rfq
                  ? ` (${settleOrder.rfq.numberOfBoxes} boxes × ${settleOrder.rfq.packagingKg} kg)`
                  : ""}
                . Invoice weight can differ slightly after loading.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Final weight (tons)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={finalWeightTons}
                    onChange={(e) => setFinalWeightTons(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit price / t (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={settleUnitPrice}
                    onChange={(e) => setSettleUnitPrice(e.target.value)}
                    placeholder="Uses quote price if empty"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Invoice total (optional override)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={invoicedAmount}
                    onChange={(e) => setInvoicedAmount(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSaveSettlement()}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Save final details
              </button>
              <div className="border-t pt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment received</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g. 30% advance"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment note</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Advance / balance / LC"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onRecordPayment()}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Record payment
                </button>
                <button
                  type="button"
                  onClick={() => setSettleOrderId(null)}
                  className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
              {(settleOrder.payments?.length || 0) > 0 ? (
                <ul className="text-[11px] text-slate-600 space-y-1">
                  {settleOrder.payments?.map((p) => (
                    <li key={p.id}>
                      {p.amount.toFixed(2)} {settleOrder.currency || "USD"} · {new Date(p.receivedAt).toLocaleDateString()}
                      {p.note ? ` · ${p.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {stageOrderId && (
            <div className="rounded-2xl border bg-white p-4">
              <div className="font-semibold text-slate-900 mb-3">
                Update order stage #{stageOrderId}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                    value={stageStatus}
                    onChange={(e) => setStageStatus(e.target.value)}
                  >
                    <option value="AWAITING_CONFIRMATION">AWAITING_CONFIRMATION</option>
                    <option value="CONTAINER_BOOKING">CONTAINER_BOOKING</option>
                    <option value="LOADED">LOADED</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DOCUMENTS_UPLOADED">DOCUMENTS_UPLOADED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Note for buyer (vessel, B/L, ETA)</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={stageNote}
                    onChange={(e) => setStageNote(e.target.value)}
                    placeholder="Shown on the buyer timeline"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateStage()}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Update stage
                </button>
                <button
                  type="button"
                  onClick={() => setStageOrderId(null)}
                  className="inline-flex items-center justify-center rounded-full border px-5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">
        {value}
        {suffix ? <span className="text-xs text-slate-500 ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}

