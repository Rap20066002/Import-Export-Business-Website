"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import Link from "next/link";

type Props = { params: { locale: Locale } };

type RFQStatus = "SUBMITTED" | "UNDER_REVIEW" | "QUOTED" | "NEGOTIATION" | "CONVERTED_TO_ORDER" | "REJECTED";

type RFQ = {
  id: number;
  status: RFQStatus;
  createdAt: string;
  buyer: { company?: string | null; email: string };
  quotations?: { id: number; pricePerTon: number; currency: string }[];
  companyDocumentKey?: string | null;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount?: number | null;
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

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

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
      const res = await apiFetch<{ url: string }>(`/rfqs/${rfqId}/company-document`, { token });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open company document");
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
          <div className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs">
            {user.name} · {user.role}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Total RFQs" value={rfqs.length} />
        <KpiCard label="Total orders" value={orders.length} />
        <KpiCard
          label="RFQs converted"
          value={rfqs.filter((r) => r.status === "CONVERTED_TO_ORDER").length}
        />
        <KpiCard label="Revenue (approx.)" value={totalRevenue.toFixed(0)} suffix="USD" />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent RFQs</h2>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">RFQ</th>
                  <th className="px-3 py-2 text-left">Buyer</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Quote</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Buyer Doc</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.slice(0, 8).map((rfq) => (
                  <tr key={rfq.id} className="border-t">
                    <td className="px-3 py-2 font-medium text-slate-900">#{rfq.id}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {rfq.buyer.company || rfq.buyer.email}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {rfq.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {rfq.quotations?.length ? (
                        <>
                          {rfq.quotations[0].pricePerTon.toFixed(2)} {rfq.quotations[0].currency}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuoteRfqId(rfq.id)}
                          className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                        >
                          Quote
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(rfq.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {rfq.companyDocumentKey ? (
                        <button
                          type="button"
                          onClick={() => openCompanyDocument(rfq.id)}
                          className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                        >
                          View
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optional)</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
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
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Update</th>
                  <th className="px-3 py-2 text-left">Documents</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {order.orderNumber || `#${order.id}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {order.totalAmount ? `${order.totalAmount.toFixed(0)} USD` : "-"}
                    </td>
                    <td className="px-3 py-2">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Note (optional)</label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={stageNote}
                    onChange={(e) => setStageNote(e.target.value)}
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

