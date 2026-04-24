"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

type RFQFormState = {
  productId: string;
  grade: string;
  quantityContainers: string;
  destinationPortId: string;
  incoterm: "FOB" | "CIF" | "CFR";
  targetPricePerTon: string;
  notes: string;
  document?: File | null;
};

type Product = {
  id: number;
  slug: string;
  nameEn: string;
  nameFa?: string | null;
  originCountry: { name: string };
};

type Port = {
  id: number;
  name: string;
  code?: string | null;
  country: { name: string };
};

export default function RFQPage({ params }: Props) {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  const [form, setForm] = useState<RFQFormState>({
    productId: "",
    grade: "",
    quantityContainers: "",
    destinationPortId: "",
    incoterm: "FOB",
    targetPricePerTon: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (field: keyof RFQFormState, value: string | File | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      setLookupsError(null);
      try {
        const [productData, portData] = await Promise.all([
          apiFetch<Product[]>("/products"),
          apiFetch<Port[]>("/lookups/ports"),
        ]);
        if (!mounted) return;
        setProducts(productData);
        setPorts(portData);
      } catch (err) {
        if (!mounted) return;
        setLookupsError(err instanceof Error ? err.message : "Failed to load products/ports");
      }
    }
    loadLookups();
    return () => {
      mounted = false;
    };
  }, []);

  if (!loading && !user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Buyer login required</h1>
        <p className="text-slate-600">
          Please create a buyer account or log in to submit a Request for Quotation (RFQ).
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/${params.locale}/buyer/login`}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Sign in
          </a>
          <a
            href={`/${params.locale}/buyer/register`}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            Create account
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = new FormData();
      const productId = Number(form.productId);
      const destinationPortId = Number(form.destinationPortId);
      data.append("productIds", JSON.stringify([productId]));
      data.append("grade", form.grade);
      data.append("quantityContainers", form.quantityContainers);
      data.append("destinationPortId", String(destinationPortId));
      data.append("incoterm", form.incoterm);
      if (form.targetPricePerTon) data.append("targetPricePerTon", form.targetPricePerTon);
      if (form.notes) data.append("notes", form.notes);
      if (form.document) data.append("companyDocument", form.document);

      await apiFetch("/rfqs", {
        method: "POST",
        body: data,
        token,
        isFormData: true,
      });
      setSuccess("RFQ submitted successfully. Our team will review and respond with a quotation.");
      setTimeout(() => router.push(`/${params.locale}/buyer/dashboard`), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit RFQ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Submit RFQ</h1>
      <p className="text-sm text-slate-600 mb-6">
        Share your requirements for bananas, dates, apples or other agro commodities. Our sales team will
        respond with a shipment-ready quotation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Product (e.g. Indian bananas, Iranian Mazafati dates)
            </label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              value={form.productId}
              onChange={(e) => handleChange("productId", e.target.value)}
              required
            >
              <option value="" disabled>
                Select a product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEn} ({p.originCountry.name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Grade</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.grade}
              onChange={(e) => handleChange("grade", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Quantity (containers)
            </label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.quantityContainers}
              onChange={(e) => handleChange("quantityContainers", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Destination port</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              value={form.destinationPortId}
              onChange={(e) => handleChange("destinationPortId", e.target.value)}
              required
            >
              <option value="" disabled>
                Select a port
              </option>
              {ports.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name} ({pt.country.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Incoterm</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              value={form.incoterm}
              onChange={(e) => handleChange("incoterm", e.target.value as RFQFormState["incoterm"])}
            >
              <option value="FOB">FOB</option>
              <option value="CIF">CIF</option>
              <option value="CFR">CFR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target price per ton (optional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.targetPricePerTon}
              onChange={(e) => handleChange("targetPricePerTon", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Additional notes</label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]"
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Company profile / registration document (PDF)
          </label>
          <input
            type="file"
            accept="application/pdf"
            className="block text-xs text-slate-600"
            onChange={(e) => handleChange("document", e.target.files?.[0] || null)}
          />
        </div>

        {lookupsError && <p className="text-xs text-red-600">{lookupsError}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit RFQ"}
        </button>
      </form>
    </div>
  );
}

