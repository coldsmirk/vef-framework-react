import type { ResubmitInstanceParams, StartInstanceParams } from "../types";

import { isDeepEqual } from "@vef-framework-react/shared";
import { useEffect, useRef, useState } from "react";

type Payload<T> = Omit<T, "idempotencyKey">;

interface Session<T> {
  key: string;
  previous?: Payload<T>;
  busy: boolean;
}

function newSubmissionKey(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Insecure-context browsers expose getRandomValues but omit randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0F) | 0x40;
  bytes[8] = (bytes[8]! & 0x3F) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Keep the submitted JSON and its replay key together until this form session ends.
 */
export function useSubmissionSession<T extends StartInstanceParams | ResubmitInstanceParams>(scope?: string) {
  const session = useRef<Session<T> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    session.current = scope === undefined ? null : { key: newSubmissionKey(), busy: false };
    setPending(false);
    setError("");

    return () => {
      session.current = null;
    };
  }, [scope]);

  async function submit(
    collect: () => Promise<Payload<T> & { idempotencyKey?: never }>,
    send: (params: Payload<T> & { idempotencyKey: string }) => Promise<unknown>,
    onSuccess: () => void | Promise<void>,
    handleError?: (cause: unknown) => boolean
  ) {
    const { current } = session;

    if (!current || current.busy) {
      return;
    }

    // Lock before async validation or business collection can yield to another click.
    current.busy = true;
    setPending(true);
    setError("");

    try {
      const values = await collect();

      if (current !== session.current) {
        return;
      }

      // Snapshot the wire representation, including toJSON conversions and omitted fields.
      const json = JSON.stringify(values);
      const params: Payload<T> = JSON.parse(json);
      const snapshot = { ...params, formData: params.formData ?? {} };

      if (current.previous && !isDeepEqual(current.previous, snapshot)) {
        current.key = newSubmissionKey();
      }

      current.previous = snapshot;
      await send({ ...params, idempotencyKey: current.key });

      if (current === session.current) {
        await onSuccess();
      }
    } catch (error_) {
      if (current === session.current && !handleError?.(error_)) {
        setError(error_ instanceof Error && error_.message ? error_.message : "提交失败，请重试");
      }
    } finally {
      current.busy = false;

      if (current === session.current) {
        setPending(false);
      }
    }
  }

  return {
    submit,
    pending,
    error
  };
}
