import type { FullTracked } from "@vef-framework-react/starter";

/**
 * Identity stamped on every mock-created row. Matches the demo account
 * configured by `auth.login` so the audit trail looks self-consistent.
 */
export const MOCK_USER = {
  id: "user-admin",
  name: "演示账号"
};

export function makeAudit(): FullTracked {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    createdBy: MOCK_USER.id,
    updatedBy: MOCK_USER.id,
    createdByName: MOCK_USER.name,
    updatedByName: MOCK_USER.name
  };
}

export function stampUpdate(): Pick<FullTracked, "updatedAt" | "updatedBy" | "updatedByName"> {
  return {
    updatedAt: new Date().toISOString(),
    updatedBy: MOCK_USER.id,
    updatedByName: MOCK_USER.name
  };
}
