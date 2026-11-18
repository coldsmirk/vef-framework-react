import type { ModalProps } from "@vef-framework-react/components";

import { Modal } from "@vef-framework-react/components";

export function CappedModal(props: Omit<ModalProps, "centered" | "styles">) {
  return (
    <Modal
      {...props}
      centered
      styles={{
        container: {
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 32px)"
        },
        header: { flexShrink: 0 },
        body: {
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflowY: "auto"
        },
        footer: { flexShrink: 0 }
      }}
    />
  );
}
