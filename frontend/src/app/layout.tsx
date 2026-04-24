import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Qum Plastic Industries - International Agro & Commodity Trade",
  description:
    "B2B international agro & commodity trade platform for bananas, dates, apples and more between India, Iran, UAE and Iraq.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
