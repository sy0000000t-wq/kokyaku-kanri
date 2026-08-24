import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { generateCycleMonths, parseYearMonth } from "../lib/calc/schedule";
import { openDb } from "./db-connect";

/**
 * §7 検証用サンプル顧客の投入。本番マイグレーションには含めない。
 * 実データは data/sample-customers.json（.gitignore 済み）に置く。
 * 無い場合は data/sample-customers.example.json（ダミー）を使う。
 */
type SampleFacility = {
  category: string;
  cycle: string;
  capacity?: number | null;
  note?: string;
};

type SampleCustomer = {
  code: string;
  name: string;
  facilities: SampleFacility[];
  inspectionCycle: string;
  monthlyFee: number;
  annualFeeHandling: "included" | "separate";
  annualInspectionFee?: number | null;
  address: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  contractStartDate: string;
  annualInspectionMonth?: number | null;
  billingCycle?: string;
  paymentLagMonths?: number;
  note?: string;
};

const dataDir = path.join(process.cwd(), "data");
const realPath = path.join(dataDir, "sample-customers.json");
const examplePath = path.join(dataDir, "sample-customers.example.json");

const sourcePath = fs.existsSync(realPath) ? realPath : examplePath;
if (!fs.existsSync(sourcePath)) {
  console.error("サンプルデータが見つかりません:", realPath);
  process.exit(1);
}
if (sourcePath === examplePath) {
  console.warn(
    "※ data/sample-customers.json が無いため、ダミーデータ（.example.json）を投入します",
  );
}

const samples: SampleCustomer[] = JSON.parse(
  fs.readFileSync(sourcePath, "utf8"),
);

const { sqlite, db } = openDb();

const categories = db.select().from(schema.equipmentCategories).all();
const categoryCycles = db.select().from(schema.categoryCycles).all();
const cycles = db.select().from(schema.inspectionCycles).all();
const billingCycles = db.select().from(schema.billingCycles).all();

if (categories.length === 0 || cycles.length === 0) {
  console.error("マスタが未投入です。先に `npm run db:migrate` を実行してください。");
  process.exit(1);
}

let inserted = 0;
for (const s of samples) {
  const exists = db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.code, s.code))
    .get();
  if (exists) {
    console.log(`  - ${s.code} ${s.name} は登録済みのためスキップ`);
    continue;
  }

  const cycle = cycles.find((c) => c.name === s.inspectionCycle);
  if (!cycle) {
    console.error(`  ! ${s.code}: 訪問周期が見つかりません`);
    continue;
  }

  const facilities = s.facilities.map((f) => {
    const category = categories.find((c) => c.name === f.category);
    const categoryCycle = category
      ? categoryCycles.find(
          (c) => c.categoryId === category.id && c.name === f.cycle,
        )
      : undefined;
    return { spec: f, category, categoryCycle };
  });

  const missing = facilities.find((f) => !f.category || !f.categoryCycle);
  if (missing) {
    console.error(
      `  ! ${s.code}: 設備区分「${missing.spec.category}」または周期「${missing.spec.cycle}」が見つかりません`,
    );
    continue;
  }
  const billingCycle =
    billingCycles.find((b) => b.name === (s.billingCycle ?? "毎月")) ??
    billingCycles[0];

  const customer = db
    .insert(schema.customers)
    .values({
      code: s.code,
      name: s.name,
      inspectionCycleId: cycle.id,
      monthlyFee: s.monthlyFee,
      annualFeeHandling: s.annualFeeHandling,
      annualInspectionFee: s.annualInspectionFee ?? null,
      address: s.address,
      contactPerson: s.contactPerson ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      contractStartDate: s.contractStartDate,
      annualInspectionMonth: s.annualInspectionMonth ?? null,
      billingCycleId: billingCycle?.id ?? null,
      paymentLagMonths: s.paymentLagMonths ?? 1,
      isActive: 1,
      note: s.note ?? "",
    })
    .returning()
    .get();

  db.insert(schema.customerFacilities)
    .values(
      facilities.map((f, i) => ({
        customerId: customer.id,
        categoryId: f.category!.id,
        categoryCycleId: f.categoryCycle!.id,
        capacity: f.spec.capacity ?? null,
        note: f.spec.note ?? "",
        sortOrder: i,
      })),
    )
    .run();

  const startMonth = parseYearMonth(s.contractStartDate)?.month ?? 1;
  const months = generateCycleMonths(startMonth, cycle.intervalMonths);
  if (months.length > 0) {
    db.insert(schema.customerInspectionMonths)
      .values(months.map((month) => ({ customerId: customer.id, month })))
      .run();
  }

  console.log(
    `  - ${s.code} ${s.name} を追加（設備 ${facilities.length} 件 / 点検月: ${months.join("・")}月）`,
  );
  inserted++;
}

sqlite.close();
console.log(`完了（${inserted} 件追加）`);
