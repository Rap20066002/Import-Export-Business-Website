import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Countries
  const countries = [
    { name: "India", code: "IN" },
    { name: "Iran", code: "IR" },
    { name: "UAE", code: "AE" },
    { name: "Iraq", code: "IQ" },
  ];

  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { name: c.name, code: c.code },
    });
  }

  const getCountryId = async (code: string) => {
    const c = await prisma.country.findUnique({ where: { code } });
    if (!c) throw new Error(`Country not found: ${code}`);
    return c.id;
  };

  // Ports
  const ports = [
    { name: "Nhava Sheva (JNPT)", code: "INNSA", countryCode: "IN" },
    { name: "Jebel Ali Port", code: "AEJEA", countryCode: "AE" },
    { name: "Khalifa Port", code: "AEKHA", countryCode: "AE" },
    { name: "Umm Qasr Port", code: "IQUMM", countryCode: "IQ" },
    { name: "Shahid Rajaee Port", code: "IRRAJ", countryCode: "IR" },
    { name: "Bushehr Port", code: "IRBUS", countryCode: "IR" },
  ];

  for (const p of ports) {
    const countryId = await getCountryId(p.countryCode);
    const existing = await prisma.port.findFirst({ where: { code: p.code } });
    if (existing) continue;
    await prisma.port.create({
      data: {
        name: p.name,
        code: p.code,
        countryId,
      },
    });
  }

  const getPortId = async (code?: string | null, name?: string) => {
    const port =
      (code ? await prisma.port.findFirst({ where: { code } }) : null) ||
      (name ? await prisma.port.findFirst({ where: { name } }) : null);
    if (!port) throw new Error(`Port not found: ${code ?? name}`);
    return port.id;
  };

  // Products
  const indiaId = await getCountryId("IN");
  const iranId = await getCountryId("IR");

  const productBananas = await prisma.product.upsert({
    where: { slug: "indian-banana-exporter" },
    update: {},
    create: {
      slug: "indian-banana-exporter",
      nameEn: "Bananas",
      nameFa: "موز",
      descriptionEn: "RFQ-based banana export from India for container-scale procurement.",
      descriptionFa: "صادرات موز از هند برای خرید کانتینری مبتنی بر درخواست قیمت.",
      originCountryId: indiaId,
      moq: 1,
      containerCapacityTons: 20,
      packagingOptions: "18kg cartons / palletized",
      incoterms: "FOB,CIF,CFR",
      isActive: true,
      metaTitle: "Banana exporter from India | Qum Plastic Industries",
      metaDescription: "Banana exporter from India. RFQ-based quotations for container-scale shipments.",
    },
  });

  const productDates = await prisma.product.upsert({
    where: { slug: "iranian-mazafati-dates-supplier" },
    update: {},
    create: {
      slug: "iranian-mazafati-dates-supplier",
      nameEn: "Mazafati Dates",
      nameFa: "خرما مضافتی",
      descriptionEn: "RFQ-based Mazafati dates supplier with documentation support.",
      descriptionFa: "تامین خرما مضافتی بر اساس RFQ با پشتیبانی اسناد تجاری.",
      originCountryId: iranId,
      moq: 1,
      containerCapacityTons: 18,
      packagingOptions: "25kg boxes / palletized",
      incoterms: "FOB,CIF,CFR",
      isActive: true,
      metaTitle: "Iranian Mazafati dates supplier | Qum Plastic Industries",
      metaDescription: "Iranian Mazafati dates supplier. RFQ-based quotations and compliant export documents.",
    },
  });

  const productApples = await prisma.product.upsert({
    where: { slug: "apple-import-export-iran" },
    update: {},
    create: {
      slug: "apple-import-export-iran",
      nameEn: "Apples (Import/Export)",
      nameFa: "سیب",
      descriptionEn: "RFQ-based apples import/export with multi-origin coordination.",
      descriptionFa: "سیب بر اساس RFQ با هماهنگی واردات/صادرات چندمبدا.",
      originCountryId: iranId,
      moq: 1,
      containerCapacityTons: 21,
      packagingOptions: "450g trays / palletized",
      incoterms: "FOB,CIF,CFR",
      isActive: true,
      metaTitle: "Apple importer and exporter – Iran | Qum Plastic Industries",
      metaDescription: "Apple importer and exporter – Iran. Request quotation privately for container shipments.",
    },
  });

  // Link products to loading ports (best-effort)
  const indiaLoadingPortId = await getPortId("INNSA");
  const iranLoadingPortId = await getPortId("IRRAJ");

  await prisma.product.update({
    where: { id: productBananas.id },
    data: {
      loadingPorts: { connect: [{ id: indiaLoadingPortId }] },
    },
  });
  await prisma.product.update({
    where: { id: productDates.id },
    data: {
      loadingPorts: { connect: [{ id: iranLoadingPortId }] },
    },
  });
  await prisma.product.update({
    where: { id: productApples.id },
    data: {
      loadingPorts: { connect: [{ id: iranLoadingPortId }] },
    },
  });

  // Internal users (admin/sales/logistics) for testing the dashboard
  const users = [
    { email: "admin@qum.test", name: "Qum Admin", company: "Qum Plastic Industries", role: "SUPER_ADMIN" as const, password: "Admin12345!" },
    { email: "sales@qum.test", name: "Qum Sales", company: "Qum Plastic Industries", role: "SALES_MANAGER" as const, password: "Sales12345!" },
    { email: "logistics@qum.test", name: "Qum Logistics", company: "Qum Plastic Industries", role: "LOGISTICS_MANAGER" as const, password: "Logistics12345!" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, company: u.company, role: u.role, password: passwordHash },
      create: {
        email: u.email,
        password: passwordHash,
        name: u.name,
        company: u.company,
        role: u.role,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

