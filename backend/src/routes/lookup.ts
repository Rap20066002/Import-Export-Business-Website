import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

router.get("/countries", async (_req, res) => {
  const countries = await prisma.country.findMany({
    orderBy: { name: "asc" },
  });
  return res.json(countries);
});

router.get("/ports", async (_req, res) => {
  const ports = await prisma.port.findMany({
    include: { country: true },
    orderBy: { name: "asc" },
  });
  return res.json(ports);
});

export const lookupRouter = router;

