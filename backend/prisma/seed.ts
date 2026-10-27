import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const countries = [
    { name: "India", code: "IN" },
    { name: "Iran", code: "IR" },
    { name: "UAE", code: "AE" },
    { name: "Iraq", code: "IQ" },
    { name: "Saudi Arabia", code: "SA" },
    { name: "Netherlands", code: "NL" },
    { name: "Germany", code: "DE" },
    { name: "Belgium", code: "BE" },
    { name: "United Kingdom", code: "GB" },
    { name: "Singapore", code: "SG" },
    { name: "China", code: "CN" },
    { name: "United States", code: "US" },
    { name: "Pakistan", code: "PK" },
    { name: "Bangladesh", code: "BD" },
    { name: "Kenya", code: "KE" },
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

  const ports = [
    { name: "Nhava Sheva (JNPT)", code: "INNSA", countryCode: "IN" },
    { name: "Jebel Ali Port", code: "AEJEA", countryCode: "AE" },
    { name: "Khalifa Port", code: "AEKHA", countryCode: "AE" },
    { name: "Umm Qasr Port", code: "IQUMM", countryCode: "IQ" },
    { name: "Shahid Rajaee Port", code: "IRRAJ", countryCode: "IR" },
    { name: "Bushehr Port", code: "IRBUS", countryCode: "IR" },
    { name: "Mundra Port", code: "INMUN", countryCode: "IN" },
    { name: "Jeddah Islamic Port", code: "SAJED", countryCode: "SA" },
    { name: "King Abdulaziz Port (Dammam)", code: "SADMN", countryCode: "SA" },
    { name: "Port of Rotterdam", code: "NLRTM", countryCode: "NL" },
    { name: "Port of Hamburg", code: "DEHAM", countryCode: "DE" },
    { name: "Port of Antwerp", code: "BEANR", countryCode: "BE" },
    { name: "Felixstowe", code: "GBFXT", countryCode: "GB" },
    { name: "Port of Singapore", code: "SGSIN", countryCode: "SG" },
    { name: "Shanghai", code: "CNSHA", countryCode: "CN" },
    { name: "Los Angeles", code: "USLAX", countryCode: "US" },
    { name: "Karachi", code: "PKKHI", countryCode: "PK" },
    { name: "Chittagong", code: "BDCGP", countryCode: "BD" },
    { name: "Mombasa", code: "KEMBA", countryCode: "KE" },
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

  const indiaId = await getCountryId("IN");
  const iranId = await getCountryId("IR");
  const indiaLoadingPortId = await getPortId("INNSA");
  const iranLoadingPortId = await getPortId("IRRAJ");

  await prisma.product.updateMany({
    where: {
      slug: {
        in: ["indian-banana-exporter", "iranian-mazafati-dates-supplier", "apple-import-export-iran"],
      },
    },
    data: { isActive: false },
  });

  const catalog = [
    {
      slug: "rabbi-dates",
      nameEn: "Rabbi Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 5,
      packagingOptions: "5 kg mother box",
      descriptionEn: "Iran-origin Rabbi dates. Standard packing 5 kg mother box; buyers can change packing on the RFQ.",
    },
    {
      slug: "mazafati-kimia-dates",
      nameEn: "Mazafati (Kimia) Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 6.5,
      packagingOptions: "6.5 kg mother box",
      descriptionEn: "Mazafati Kimia dates. Standard packing 6.5 kg mother box.",
    },
    {
      slug: "mazafati-loose-dates",
      nameEn: "Mazafati Loose Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 5,
      packagingOptions: "5 kg mother box",
      descriptionEn: "Mazafati loose dates with 5 kg mother-box packing.",
    },
    {
      slug: "mazafati-semi-dry-dates",
      nameEn: "Mazafati Semi Dry Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 5,
      packagingOptions: "5 kg mother box",
      descriptionEn: "Mazafati semi-dry dates with 5 kg mother-box packing.",
    },
    {
      slug: "kaluteh-dates",
      nameEn: "Kaluteh Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 5,
      packagingOptions: "5 kg mother box",
      descriptionEn: "Kaluteh dates, standard 5 kg mother-box packing.",
    },
    {
      slug: "kabkab-dates",
      nameEn: "Kabkab Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 1,
      packagingOptions: "1 kg mother box",
      descriptionEn: "Kabkab dates with 1 kg mother-box packing.",
    },
    {
      slug: "shahani-dates",
      nameEn: "Shahani Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 3,
      packagingOptions: "3 kg mother box",
      descriptionEn: "Shahani dates, standard 3 kg mother-box packing.",
    },
    {
      slug: "zahedi-dates",
      nameEn: "Zahedi Dates",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 10,
      packagingOptions: "10 kg mother box",
      descriptionEn: "Zahedi dates with 10 kg mother-box packing.",
    },
    {
      slug: "export-bananas",
      nameEn: "Banana",
      originCountryId: indiaId,
      loadingPortId: indiaLoadingPortId,
      defaultPackagingKg: 13,
      packagingOptions: "13 kg mother box",
      descriptionEn: "Export bananas from India. Standard packing 13 kg mother box.",
    },
    {
      slug: "export-apples",
      nameEn: "Apple",
      originCountryId: iranId,
      loadingPortId: iranLoadingPortId,
      defaultPackagingKg: 10,
      packagingOptions: "10 kg mother box",
      descriptionEn: "Apples for import/export. Standard packing 10 kg mother box.",
    },
  ];

  for (const item of catalog) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        nameEn: item.nameEn,
        descriptionEn: item.descriptionEn,
        originCountryId: item.originCountryId,
        defaultPackagingKg: item.defaultPackagingKg,
        packagingOptions: item.packagingOptions,
        isActive: true,
        metaTitle: `${item.nameEn} | Qum Impex`,
        metaDescription: item.descriptionEn,
      },
      create: {
        slug: item.slug,
        nameEn: item.nameEn,
        descriptionEn: item.descriptionEn,
        originCountryId: item.originCountryId,
        moq: 1,
        containerCapacityTons: 20,
        defaultPackagingKg: item.defaultPackagingKg,
        packagingOptions: item.packagingOptions,
        incoterms: "FOB,CIF,CFR",
        isActive: true,
        metaTitle: `${item.nameEn} | Qum Impex`,
        metaDescription: item.descriptionEn,
      },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { loadingPorts: { connect: [{ id: item.loadingPortId }] } },
    });
  }

  await prisma.orderPayment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.rfqMessage.deleteMany();
  await prisma.rFQItem.deleteMany();
  await prisma.rFQ.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("abc1234", 10);
  await prisma.user.create({
    data: {
      email: "qumplastic.sales@gmail.com",
      password: passwordHash,
      name: "Qum Impex Admin",
      company: "Qum Impex",
      role: "SUPER_ADMIN",
    },
  });

  console.log("Seed complete: catalog kept; users, RFQs, orders and revenue wiped; launch admin created");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
