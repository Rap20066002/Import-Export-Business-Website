"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { CONTAINER_TYPES, PRICE_CURRENCIES, estimatedWeightTons, type ContainerType } from "@/lib/trade";

type Props = { params: { locale: Locale } };

type RFQFormState = {
  productId: string;
  grade: string;
  quantityContainers: string;
  containerType: ContainerType;
  packagingKg: string;
  numberOfBoxes: string;
  destinationPortId: string;
  incoterm: "FOB" | "CIF" | "CFR";
  targetPricePerTon: string;
  targetPriceCurrency: string;
  notes: string;
  document?: File | null;
};

type Product = {
  id: number;
  slug: string;
  nameEn: string;
  nameFa?: string | null;
  defaultPackagingKg?: number;
  packagingOptions?: string;
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
    quantityContainers: "1",
    containerType: "DRY_20",
    packagingKg: "",
    numberOfBoxes: "",
    destinationPortId: "",
    incoterm: "FOB",
    targetPricePerTon: "",
    targetPriceCurrency: "USD",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (field: keyof RFQFormState, value: string | File | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedProduct = products.find((p) => String(p.id) === form.productId);
  const estTons = estimatedWeightTons(Number(form.packagingKg) || 0, Number(form.numberOfBoxes) || 0);

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
      data.append("productIds", JSON.stringify([Number(form.productId)]));
      data.append("grade", form.grade);
      data.append("quantityContainers", form.quantityContainers);
      data.append("containerType", form.containerType);
      data.append("packagingKg", form.packagingKg);
      data.append("numberOfBoxes", form.numberOfBoxes);
      data.append("destinationPortId", form.destinationPortId);
      data.append("incoterm", form.incoterm);
      if (form.targetPricePerTon) {
        data.append("targetPricePerTon", form.targetPricePerTon);
        data.append("targetPriceCurrency", form.targetPriceCurrency);
      }
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
        Request a private quotation for dates, bananas or apples. Packing defaults to our standard mother-box
        weight; you can change it to match your requirement.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              value={form.productId}
              onChange={(e) => {
                const nextId = e.target.value;
                const product = products.find((p) => String(p.id) === nextId);
                setForm((prev) => ({
                  ...prev,
                  productId: nextId,
                  packagingKg: product?.defaultPackagingKg ? String(product.defaultPackagingKg) : prev.packagingKg,
                }));
              }}
              required
            >
              <option value="" disabled>
                Select a product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEn} ({p.originCountry.name}
                  {p.defaultPackagingKg ? ` · ${p.defaultPackagingKg} kg box` : ""})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Grade (optional)</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.grade}
              onChange={(e) => handleChange("grade", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Packaging weight (kg / mother box)</label>
            <input
              type="number"
              min={0.1}
              step="0.1"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.packagingKg}
              onChange={(e) => handleChange("packagingKg", e.target.value)}
              required
            />
            {selectedProduct?.packagingOptions ? (
              <p className="mt-1 text-[11px] text-slate-500">Standard: {selectedProduct.packagingOptions}. You can change this.</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Number of boxes</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.numberOfBoxes}
              onChange={(e) => handleChange("numberOfBoxes", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Container type</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              value={form.containerType}
              onChange={(e) => handleChange("containerType", e.target.value)}
              required
            >
              {CONTAINER_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Number of containers</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.quantityContainers}
              onChange={(e) => handleChange("quantityContainers", e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
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

        {estTons > 0 ? (
          <p className="text-xs text-slate-600 rounded-lg bg-slate-50 border px-3 py-2">
            Estimated cargo weight: <span className="font-semibold">{estTons.toFixed(3)} tons</span> (
            {form.numberOfBoxes} × {form.packagingKg} kg). Final invoice weight can be set by our team after loading.
          </p>
        ) : null}

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
            <label className="block text-xs font-medium text-slate-700 mb-1">Target price per ton (optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.targetPricePerTon}
                onChange={(e) => handleChange("targetPricePerTon", e.target.value)}
                placeholder="Price"
              />
              <select
                className="w-28 rounded-md border px-2 py-2 text-sm bg-white"
                value={form.targetPriceCurrency}
                onChange={(e) => handleChange("targetPriceCurrency", e.target.value)}
              >
                {PRICE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
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
            Company profile / registration document (PDF, max 10MB)
          </label>
          <input
            type="file"
            accept="application/pdf,image/*,.doc,.docx"
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
