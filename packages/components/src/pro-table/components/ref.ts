import type { PropsWithRef } from "../../_base";
import type { ProTableRef } from "../types";

import { useImperativeHandle } from "react";

import { useProTableStore } from "../store";

export function ProTableRefHolder({ ref }: PropsWithRef<ProTableRef>) {
  const refetch = useProTableStore(state => state.refetch);
  const emitter = useProTableStore(state => state.eventEmitter);

  useImperativeHandle(ref, () => {
    return {
      refetch,
      onLoading: (callback: () => void) => emitter.on("loading", callback),
      onLoaded: (callback: () => void) => emitter.on("loaded", callback)
    };
  }, [emitter, refetch]);

  return null;
}
