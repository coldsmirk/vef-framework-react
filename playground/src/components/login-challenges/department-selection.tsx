import type { LoginChallengeRendererProps } from "@vef-framework-react/starter";

import { Button, Empty, Group, Icon, Radio, Stack } from "@vef-framework-react/components";
import { Building2Icon } from "lucide-react";
import { useMemo, useState } from "react";

export const DEPARTMENT_SELECTION_CHALLENGE_TYPE = "department_selection";

export interface DepartmentOption {
  id: string;
  name: string;
}

export function DepartmentSelectionChallenge({
  challenge,
  pending,
  resolve,
  cancel
}: LoginChallengeRendererProps<typeof DEPARTMENT_SELECTION_CHALLENGE_TYPE>) {
  const departments = useMemo(
    () => challenge.data.departments ?? [],
    [challenge.data]
  );

  const [selected, setSelected] = useState<string | undefined>(
    () => departments[0]?.id
  );

  const canConfirm = Boolean(selected) && !pending;

  async function handleConfirm() {
    if (!selected) {
      return;
    }

    await resolve(selected);
  }

  return (
    <Stack gap="medium">
      <div>
        <h2 style={{
          margin: 0,
          fontWeight: 600,
          fontSize: 20
        }}
        >
          <Group align="center" gap="small">
            <Icon component={Building2Icon} />
            选择登录部门
          </Group>
        </h2>

        <p style={{ margin: "8px 0 0", opacity: 0.7 }}>
          您归属多个部门，请选择本次登录所代表的部门
        </p>
      </div>

      {departments.length === 0
        ? <Empty description="未查询到可用的部门，请联系管理员" />
        : (
            <Radio.Group
              value={selected}
              onChange={e => setSelected(e.target.value as string)}
            >
              <Stack gap="small">
                {departments.map(dept => (
                  <Radio key={dept.id} value={dept.id}>
                    {dept.name}
                  </Radio>
                ))}
              </Stack>
            </Radio.Group>
          )}

      <Stack gap="small">
        {departments.length > 0 && (
          <Button
            block
            disabled={!canConfirm}
            loading={pending}
            size="large"
            type="primary"
            onClick={handleConfirm}
          >
            确认进入
          </Button>
        )}

        <Button block disabled={pending} size="large" onClick={cancel}>
          返回登录
        </Button>
      </Stack>
    </Stack>
  );
}
