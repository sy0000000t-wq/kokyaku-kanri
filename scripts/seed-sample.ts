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
type SampleCustomer = {
  code: string;
  name: string;
  facilityType: string;
  capacityKva?: number | null;
  capacityKw?: number | null;
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

const facilityTypes = db.select().from(schema.facilityTypes).all();
const cycles = db.select().from(schema.inspectionCycles).all();
const billingCycles = db.select().from(schema.billingCycles).all();

if (facilityTypes.length === 0 || cycles.length === 0) {
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

  const facilityType = facilityTypes.find((f) => f.name === s.facilityType);
  const cycle = cycles.find((c) => c.name === s.inspectionCycle);
  if (!facilityType || !cycle) {
    console.error(`  ! ${s.code}: 施設種別または点検周期が見つかりません`);
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
      facilityTypeId: facilityType.id,
      capacityKva: s.capacityKva ?? null,
      capacityKw: s.capacityKw ?? null,
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

  const startMonth = parseYearMonth(s.contractStartDate)?.month ?? 1;
  const months = generateCycleMonths(startMonth, cycle.intervalMonths);
  if (months.length > 0) {
    db.insert(schema.customerInspectionMonths)
      .values(months.map((month) => ({ customerId: customer.id, month })))
      .run();
  }

  console.log(`  - ${s.code} ${s.name} を追加（点検月: ${months.join("・")}月）`);
  inserted++;
}

sqlite.close();
console.log(`完了（${inserted} 件追加）`);
