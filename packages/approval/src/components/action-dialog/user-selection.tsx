import { Alert, Labeled, Stack } from "@vef-framework-react/components";
import { isBusinessError } from "@vef-framework-react/core";
import { useState } from "react";

import { useConfirm } from ".";
import { PrincipalSelect } from "../principal";

/**
 * Keeps the explicit selection and the server's rejection together until the operator chooses again.
 */
export function useUserAction(onClose: () => void) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [failure, setFailure] = useState<{ message: string; requiresNewSelection: boolean }>();
  const { submitting, run } = useConfirm(onClose, error => {
    setFailure({
      message: error instanceof Error && error.message ? error.message : "操作未完成，请重试。",
      requiresNewSelection: isBusinessError(error) && error.code === 40_028
    });
  });

  function select(ids: string[]) {
    setUserIds(ids);
    setFailure(undefined);
  }

  return {
    userIds,
    select,
    failure,
    submitting,
    run
  };
}

export function UserActionField({
  label,
  maxCount,
  selection
}: {
  label: string;
  maxCount: number;
  selection: ReturnType<typeof useUserAction>;
}) {
  return (
    <Labeled label={label}>
      <Stack gap={6}>
        <PrincipalSelect disabled={selection.submitting} kind="user" maxCount={maxCount} value={selection.userIds} onChange={selection.select} />
        {selection.failure && <Alert showIcon description={selection.failure.requiresNewSelection ? "请重新选择人员后再提交。" : undefined} title={selection.failure.message} type={selection.failure.requiresNewSelection ? "warning" : "error"} />}
      </Stack>
    </Labeled>
  );
}
