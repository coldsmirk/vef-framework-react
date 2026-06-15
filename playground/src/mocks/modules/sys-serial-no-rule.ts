import { faker } from "@faker-js/faker";

import { createCrudMock } from "../helpers/crud";
import { enrichWithDictNames } from "../helpers/dict-enrich";

interface SerialNoRuleRow {
  id: string;
  key: string;
  name: string;
  prefix?: string | null;
  suffix?: string | null;
  dateFormat?: string | null;
  seqLength: number;
  seqStep: number;
  resetCycle: string;
  currentValue: number;
  lastResetAt?: string | null;
  isActive: boolean;
  remark?: string | null;
}

createCrudMock<SerialNoRuleRow>({
  resource: "sys/serial_no_rule",
  seed: 6,
  searchFields: ["key", "name"],
  decorate: enrichWithDictNames({
    dateFormat: "sys.serial_no_rule.date_format",
    resetCycle: "sys.serial_no_rule.reset_cycle"
  }),
  factory: i => {
    return {
      id: faker.string.uuid(),
      key: ["order.no", "patient.no", "ticket.no", "invoice.no", "report.no", "po.no"][i] ?? `serial.${i}`,
      name: ["订单流水号", "患者编号", "工单号", "发票号", "报告编号", "采购单号"][i] ?? `流水号 ${i + 1}`,
      prefix: ["ORD", "PT", "TK", "INV", "RPT", "PO"][i] ?? null,
      suffix: null,
      dateFormat: i % 2 === 0 ? "YYYYMMDD" : null,
      seqLength: 6,
      seqStep: 1,
      resetCycle: i % 3 === 0 ? "DAILY" : i % 3 === 1 ? "MONTHLY" : "NEVER",
      currentValue: faker.number.int({ min: 0, max: 9999 }),
      lastResetAt: null,
      isActive: true,
      remark: null
    };
  }
});
