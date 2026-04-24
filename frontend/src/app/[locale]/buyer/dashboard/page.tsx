"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

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
  incoterm: string;
  quotations?: { id: number; pricePerTon: number; currency: string; validityDate: string }[];
  order?: { id: number; orderNumber: string }[];
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

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<RFQ[]>("/rfqs", { token }),
      apiFetch<Order[]>("/orders", { token }),
    ])
      .then(([rfqData, orderData]) => {
        setRfqs(rfqData);
        setOrders(orderData);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load dashboard data.";
        setError(message);
      });
  }, [token]);

  const onConfirmOrder = async (rfqId: number) => {
    if (!token) return;
    setConfirming(rfqId);
    try {
      await apiFetch(`/rfqs/${rfqId}/confirm`, { method: "POST", token, body: {} });
      // refresh
      const [rfqData, orderData] = await Promise.all([
        apiFetch<RFQ[]>("/rfqs", { token }),
        apiFetch<Order[]>("/orders", { token }),
      ]);
      setRfqs(rfqData);
      setOrders(orderData);
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
          <div className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs">
            {user.name} · {user.company || user.email}
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
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                    No RFQs yet. Once you submit, they will appear here.
                  </td>
                </tr>
              )}
              {rfqs.map((rfq) => (
                <tr key={rfq.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-900">#{rfq.id}</td>
                  <td className="px-3 py-2">
                    <StatusPill label={rfq.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {rfq.status === "QUOTED" && rfq.quotations?.length ? (
                      <>
                        {rfq.quotations[0].pricePerTon.toFixed(2)} {rfq.quotations[0].currency}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">{rfq.quantityContainers}</td>
                  <td className="px-3 py-2">{rfq.incoterm}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(rfq.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {rfq.status === "QUOTED" && !rfq.order?.length ? (
                      <button
                        type="button"
                        disabled={confirming === rfq.id}
                        onClick={() => onConfirmOrder(rfq.id)}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {confirming === rfq.id ? "Confirming..." : "Confirm order"}
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

