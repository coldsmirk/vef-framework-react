import type { ReactElement } from "react";

import { Button } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";
import { useDeviceRegistries } from "../../store/engine-provider";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { syncMobileFromPc } from "../sync-mobile-from-pc";

/**
 * Actions on the mobile presentation as a whole, shown above the phone while
 * editing it. Absent while mobile is undesigned: the seed state inside the phone
 * offers the same sync there, next to the blank start.
 */
export function MobileActions(): ReactElement | null {
  const isOffered = useFormEditorStore(s => s.viewMode === "edit" && s.schema.presentations.mobile !== undefined);
  const storeApi = useFormEditorStoreApi();
  const registries = useDeviceRegistries();

  if (!isOffered) {
    return null;
  }

  return (
    <Button
      icon={<EditorIcon name="refresh-cw" />}
      type="text"
      onClick={() => syncMobileFromPc(storeApi, registries)}
    >
      从 PC 同步
    </Button>
  );
}
