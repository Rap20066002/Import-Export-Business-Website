"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = {
  params: { locale: Locale; id: string };
};

type Doc = {
  id: number;
  type: string;
  fileName: string;
  uploadedAt: string;
};

export default function BuyerOrderDocumentsPage({ params }: Props) {
  const { user, token, loading } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState<
    "PROFORMA_INVOICE" | "COMMERCIAL_INVOICE" | "PACKING_LIST" | "BILL_OF_LADING" | "PHYTOSANITARY_CERTIFICATE" | "OTHER"
  >("COMMERCIAL_INVOICE");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<Doc[]>(`/orders/${params.id}/documents`, { token })
      .then(setDocs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"));
  }, [token, params.id]);

  const uploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("type", docType);
      fd.append("file", file);
      await apiFetch(`/orders/${params.id}/documents`, {
        method: "POST",
        token,
        body: fd,
        isFormData: true,
      });
      const updated = await apiFetch<Doc[]>(`/orders/${params.id}/documents`, { token });
      setDocs(updated);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const download = async (documentId: number) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${params.id}/documents/${documentId}/download`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Download failed");
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="(.+?)"/);
      const fileName = fileNameMatch?.[1] || `document-${documentId}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const deleteDocument = async (documentId: number) => {
    if (!token) return;
    try {
      await apiFetch(`/orders/${params.id}/documents/${documentId}`, {
        method: "DELETE",
        token,
      });
      const updated = await apiFetch<Doc[]>(`/orders/${params.id}/documents`, { token });
      setDocs(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const canDelete =
    user?.role === "SUPER_ADMIN" || user?.role === "SALES_MANAGER" || user?.role === "LOGISTICS_MANAGER";

  if (!loading && !token) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-sm">
        <p className="text-slate-600">Please sign in to view documents.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-sm">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Order documents</h1>
      <p className="text-slate-600 mb-6">
        Upload/download shipment documents privately for your order.
      </p>

      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Uploaded documents</h2>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Uploaded</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                      No documents yet.
                    </td>
                  </tr>
                ) : (
                  docs.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2 text-slate-700">{d.type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-slate-900 font-medium">{d.fileName}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(d.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => download(d.id)}
                            className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                          >
                            Download
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => deleteDocument(d.id)}
                              className="inline-flex items-center justify-center rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Upload document</h2>
          <form onSubmit={uploadDoc} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                value={docType}
                onChange={(e) =>
                  setDocType(
                    e.target.value as
                      | "PROFORMA_INVOICE"
                      | "COMMERCIAL_INVOICE"
                      | "PACKING_LIST"
                      | "BILL_OF_LADING"
                      | "PHYTOSANITARY_CERTIFICATE"
                      | "OTHER"
                  )
                }
              >
                <option value="PROFORMA_INVOICE">Proforma invoice</option>
                <option value="COMMERCIAL_INVOICE">Commercial invoice</option>
                <option value="PACKING_LIST">Packing list</option>
                <option value="BILL_OF_LADING">Bill of lading</option>
                <option value="PHYTOSANITARY_CERTIFICATE">Phytosanitary certificate</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">File (PDF recommended)</label>
              <input
                type="file"
                className="block w-full text-xs text-slate-600"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 w-full"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

