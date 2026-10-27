"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { RfqThread, type RfqThreadMessage } from "@/components/rfq-thread";
import { isQuoteExpired } from "@/lib/trade";

type Props = { params: { locale: Locale } };

type RFQStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "QUOTED"
  | "NEGOTIATION"
  | "CONVERTED_TO_ORDER"
  | "REJECTED";

type OrderStatus =
  | "AWAITING_CONFIRMATION"
  | "CONTAINER_BOOKING"
  | "LOADED"
  | "SHIPPED"
  | "DOCUMENTS_UPLOADED"
  | "COMPLETED";

type RFQ = {
  id: number;
  status: RFQStatus;
  createdAt: string;
  quantityContainers: number;
  containerType?: string;
  packagingKg?: number;
  numberOfBoxes?: number;
  incoterm: string;
  items?: { product: { nameEn: string } }[];
  notes?: string | null;
  grade?: string | null;
  quotations?: { id: number; pricePerTon: number; currency: string; validityDate: string; notes?: string | null }[];
  order?: { id: number; orderNumber: string }[];
  messages?: RfqThreadMessage[];
};

type Order = {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  statusHistory?: { status: string; createdAt: string; note?: string | null }[];
};

export default function BuyerDashboard({ params }: Props) {
  const { user, token, loading } = useAuth();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [rfqData, orderData] = await Promise.all([
      apiFetch<RFQ[]>("/rfqs", { token }),
      apiFetch<Order[]>("/orders", { token }),
    ]);
    setRfqs(rfqData);
    setOrders(orderData);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to load dashboard data.";
      setError(message);
    });
  }, [token, refresh]);

  const onConfirmOrder = async (rfqId: number) => {
    if (!token) return;
    const notes = window.prompt("Optional note for the sales team (packing, payment, delivery window)") || undefined;
    setConfirming(rfqId);
    try {
      await apiFetch(`/rfqs/${rfqId}/confirm`, { method: "POST", token, body: { notes } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm order");
    } finally {
      setConfirming(null);
    }
  };

  if (!loading && !user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Buyer dashboard</h1>
        <p className="text-slate-600">Please log in to view your RFQs and orders.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Buyer dashboard</h1>
          <p className="text-slate-600">
            Track your RFQs, quotations and order lifecycle inside one secure workspace.
          </p>
        </div>
        {user && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs">
              {user.name} · {user.company || user.email}
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Active RFQs</h2>
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">RFQ ID</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Quotation</th>
                <th className="px-3 py-2 text-left">Quantity (containers)</th>
                <th className="px-3 py-2 text-left">Incoterm</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                    No RFQs yet. Once you submit, they will appear here.
                  </td>
                </tr>
              )}
              {rfqs.map((rfq) => (
                <tr key={rfq.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-900">#{rfq.id}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {rfq.items?.map((item) => item.product.nameEn).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill label={rfq.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {rfq.quotations?.length && (rfq.status === "QUOTED" || rfq.status === "NEGOTIATION") ? (
                      <>
                        {rfq.quotations[0].pricePerTon.toFixed(2)} {rfq.quotations[0].currency}
                        {rfq.quotations[0].validityDate ? (
                          <div
                            className={`text-[11px] ${
                              isQuoteExpired(rfq.quotations[0].validityDate) ? "font-semibold text-red-600" : "text-slate-500"
                            }`}
                          >
                            {isQuoteExpired(rfq.quotations[0].validityDate)
                              ? `Expired ${new Date(rfq.quotations[0].validityDate).toLocaleDateString()}`
                              : `Valid until ${new Date(rfq.quotations[0].validityDate).toLocaleDateString()}`}
                          </div>
                        ) : null}
                        {rfq.quotations[0].notes ? (
                          <div className="text-[11px] text-slate-500">{rfq.quotations[0].notes}</div>
                        ) : null}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {rfq.quantityContainers}
                    {rfq.numberOfBoxes ? (
                      <div className="text-[11px] text-slate-500">
                        {rfq.numberOfBoxes} boxes
                        {rfq.packagingKg ? ` × ${rfq.packagingKg} kg` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{rfq.incoterm}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(rfq.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {(rfq.status === "QUOTED" || rfq.status === "NEGOTIATION") && !rfq.order?.length ? (
                        isQuoteExpired(rfq.quotations?.[0]?.validityDate) ? (
                          <span className="text-[11px] font-medium text-red-600">Quote expired — ask for a revised quote</span>
                        ) : (
                          <button
                            type="button"
                            disabled={confirming === rfq.id}
                            onClick={() => onConfirmOrder(rfq.id)}
                            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {confirming === rfq.id ? "Confirming..." : "Confirm order"}
                          </button>
                        )
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpenThreadId(openThreadId === rfq.id ? null : rfq.id)}
                        className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                      >
                        {(rfq.messages?.length || 0) > 0 ? `${rfq.messages?.length} notes` : "Notes"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {openThreadId && token ? (
          <RfqThread
            rfqId={openThreadId}
            token={token}
            messages={rfqs.find((r) => r.id === openThreadId)?.messages || []}
            onPosted={refresh}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Orders</h2>
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                    No orders yet. Once an RFQ is converted to order, it will appear here.
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {order.orderNumber || `#${order.id}`}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill label={order.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
              Order status timeline
            </h3>
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {order.orderNumber || `#${order.id}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      Current status: {order.status.replace(/_/g, " ")}
                    </div>
                  </div>
                  <a
                    href={`/${params.locale}/buyer/orders/${order.id}/documents`}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[11px] font-semibold text-white hover:bg-slate-800"
                  >
                    Documents
                  </a>
                </div>

                <div className="mt-3 space-y-2">
                  {(order.statusHistory ?? [])
                    .slice()
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((h, idx) => (
                      <div key={`${order.id}-${idx}`} className="flex gap-3 items-start">
                        <div className="mt-1 w-2 h-2 rounded-full bg-emerald-600" />
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {h.status.replace(/_/g, " ")}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(h.createdAt).toLocaleDateString()}
                            {h.note ? ` • ${h.note}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}

                  {(order.statusHistory ?? []).length === 0 ? (
                    <div className="text-xs text-slate-500">No status updates yet.</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
      {label.replace(/_/g, " ")}
    </span>
  );
}

