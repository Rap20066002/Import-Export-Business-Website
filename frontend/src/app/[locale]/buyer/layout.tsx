import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buyer portal",
  robots: { index: false, follow: false, nocache: true },
};

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
