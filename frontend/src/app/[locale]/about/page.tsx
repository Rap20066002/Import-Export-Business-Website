import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

export default function AboutPage({ params }: Props) {
  const t = getTranslations(params.locale);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 text-sm space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t.about.title}</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
          Qum Plastic Industries supports international agro & commodity trade with disciplined
          documentation and logistics coordination.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card title="Trade Regions">
          India, Iran, UAE, Iraq and broader corridors supported by supplier networks and seasonal
          planning.
        </Card>
        <Card title="Infrastructure">
          Procurement coordination, shipment planning, container loading assistance and document
          delivery workflow.
        </Card>
        <Card title="Compliance & Documentation">
          RFQ-first procurement with documentation expertise for import clearance requirements.
        </Card>
        <Card title="What makes it B2B">
          No public pricing. Quotes are provided privately per RFQ, destination port and Incoterms.
        </Card>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-sm font-semibold text-slate-900 mb-2">{title}</div>
      <div className="text-xs text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

