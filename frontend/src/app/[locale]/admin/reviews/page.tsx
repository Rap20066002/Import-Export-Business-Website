"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

type CatalogProduct = { id: number; slug: string; nameEn: string };

type AdminReview = {
  id: number;
  productId: number;
  body: string;
  authorName: string | null;
  country: string | null;
  rating: number | null;
  reviewDate: string | null;
  isPublished: boolean;
  createdAt: string;
  product: { id: number; slug: string; nameEn: string };
};

function localTodayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inputDateValue(value?: string | null) {
  if (!value) return "";
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function emptyForm() {
  return {
    productId: "",
    authorName: "",
    body: "",
    country: "",
    rating: "",
    reviewDate: localTodayYmd(),
    isPublished: false,
  };
}

export default function AdminReviewsPage({ params }: Props) {
  const { user, token, loading } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "SALES_MANAGER" || user?.role === "LOGISTICS_MANAGER";

  const refresh = useCallback(async () => {
    if (!token) return;
    const [reviewData, productData] = await Promise.all([
      apiFetch<AdminReview[]>("/reviews", { token }),
      apiFetch<CatalogProduct[]>("/products"),
    ]);
    setReviews(reviewData);
    setProducts(productData);
  }, [token]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load reviews.");
    });
  }, [token, isAdmin, refresh]);

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Manage reviews</h1>
        <p className="text-slate-600">Only internal admin users can manage customer feedback.</p>
        <Link
          href={`/${params.locale}/admin/login`}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Go to admin login
        </Link>
      </div>
    );
  }

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const payload = () => ({
    productId: Number(form.productId),
    authorName: form.authorName.trim() || null,
    body: form.body.trim(),
    country: form.country.trim() || null,
    rating: form.rating ? Number(form.rating) : null,
    reviewDate: form.reviewDate.trim() || null,
    isPublished: form.isPublished,
  });

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiFetch(`/reviews/${editingId}`, { method: "PUT", token, body: payload() });
      } else {
        await apiFetch("/reviews", { method: "POST", token, body: payload() });
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const onTogglePublish = async (review: AdminReview) => {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/reviews/${review.id}/publish`, {
        method: "PATCH",
        token,
        body: { isPublished: !review.isPublished },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update publish state");
    }
  };

  const onDelete = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    setError(null);
    try {
      await apiFetch(`/reviews/${id}`, { method: "DELETE", token });
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete review");
    }
  };

  const startEdit = (review: AdminReview) => {
    setEditingId(review.id);
    setForm({
      productId: String(review.productId),
      authorName: review.authorName || "",
      body: review.body,
      country: review.country || "",
      rating: review.rating ? String(review.rating) : "",
      reviewDate: inputDateValue(review.reviewDate) || inputDateValue(review.createdAt) || localTodayYmd(),
      isPublished: review.isPublished,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manage reviews</h1>
          <p className="text-slate-600">
            Add genuine customer feedback per product. Use the customer or team name they actually gave — do not
            invent names. Leave rating empty unless they provided one. A name is required for Google Review markup.
          </p>
        </div>
        <Link
          href={`/${params.locale}/admin`}
          className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          Back to admin
        </Link>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <section className="rounded-2xl border bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {editingId ? "Edit review" : "Add review"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-600 space-y-1">
            <span>Product</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 space-y-1">
            <span>Customer / author name</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              maxLength={99}
              value={form.authorName}
              onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
              placeholder="Real person or procurement team name"
            />
          </label>
          <label className="text-xs text-slate-600 space-y-1">
            <span>Country (optional)</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-600 space-y-1 sm:col-span-2">
            <span>Review text</span>
            <textarea
              className="w-full min-h-[96px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-600 space-y-1">
            <span>Rating 1–5 (optional)</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.rating}
              onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
            >
              <option value="">No rating provided</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 space-y-1">
            <span>Review Date</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              max={localTodayYmd()}
              value={form.reviewDate}
              onChange={(e) => setForm((f) => ({ ...f, reviewDate: e.target.value }))}
            />
            <span className="block text-[11px] text-slate-500">
              Date the customer actually gave this feedback. Not the date it was entered here.
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 pt-6">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
            />
            Publish on the product page
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !form.productId || !form.body.trim()}
            onClick={() => void onSave()}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {editingId ? "Save changes" : "Add review"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-xs min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Author</th>
              <th className="px-3 py-2 text-left">Feedback</th>
              <th className="px-3 py-2 text-left">Country</th>
              <th className="px-3 py-2 text-left">Rating</th>
              <th className="px-3 py-2 text-left">Review date</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={8}>
                  No reviews yet. Add genuine customer feedback above. Nothing is shown on the public site until
                  you publish it.
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="border-t">
                  <td className="px-3 py-2 align-top">{review.product.nameEn}</td>
                  <td className="px-3 py-2 align-top">{review.authorName || "—"}</td>
                  <td className="px-3 py-2 align-top max-w-sm">{review.body}</td>
                  <td className="px-3 py-2 align-top">{review.country || "—"}</td>
                  <td className="px-3 py-2 align-top">{review.rating ?? "—"}</td>
                  <td className="px-3 py-2 align-top">
                    {inputDateValue(review.reviewDate) || inputDateValue(review.createdAt) || "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {review.isPublished ? "Published" : "Unpublished"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-emerald-800 hover:underline"
                        onClick={() => startEdit(review)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-emerald-800 hover:underline"
                        onClick={() => void onTogglePublish(review)}
                      >
                        {review.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="text-red-700 hover:underline"
                        onClick={() => void onDelete(review.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
