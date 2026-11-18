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
  const [message, setMessage] = useState("");
  const { submitting, run } = useConfirm(onClose, error => {
    if (isBusinessError(error) && error.code === 40_028) {
      setMessage(error.message);
    }
  });

  function select(ids: string[]) {
    setUserIds(ids);
    setMessage("");
  }

  return {
    userIds,
    select,
    message,
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
        {selection.message && <Alert showIcon description="请重新选择人员后再提交。" title={selection.message} type="warning" />}
      </Stack>
    </Labeled>
  );
}
