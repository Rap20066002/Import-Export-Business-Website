import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

export default function TradeProcessPage({ params }: Props) {
  const t = getTranslations(params.locale);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 text-sm">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t.trade.title}</h1>
      <p className="text-slate-600 mb-8 max-w-2xl">
        A compliant RFQ workflow from inquiry to proforma invoice, booking, shipment and document
        delivery.
      </p>

      <ol className="space-y-4">
        <Step n="1" title="Inquiry (RFQ submitted)">
          Buyer submits product, grade, containers, destination port and Incoterms. Upload a company
          profile document if needed.
        </Step>
        <Step n="2" title="Quotation">
          Admin responds with quoted price per ton tailored to destination requirements.
        </Step>
        <Step n="3" title="Order confirmation">
          Buyer confirms the quotation, triggering order creation and proforma invoice generation.
        </Step>
        <Step n="4" title="Proforma invoice">
          Proforma invoice PDF is generated and stored; both buyer and admin receive email notifications.
        </Step>
        <Step n="5" title="Container booking">
          Logistics manager updates order stage and coordinates booking readiness.
        </Step>
        <Step n="6" title="Shipment">
          Stage updates track loading and shipping milestones until completion.
        </Step>
        <Step n="7" title="Document delivery">
          Upload/download official documents through the secure documents section.
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border bg-white p-5 flex gap-4">
      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-semibold">
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-600 mt-1 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

