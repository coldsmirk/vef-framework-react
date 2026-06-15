import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@vef-framework-react/components";

import { Aside } from "./components/aside";
import { ConfigItems } from "./components/config-items";
import { Header } from "./components/header";
import { ConfigPageStoreProvider } from "./store";

export const Route = createFileRoute("/_layout/sys/config")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return (
    <ConfigPageStoreProvider>
      <Page
        margin
        scrollable
        header={<Header />}
        leftAside={<Aside />}
        leftAsideWidth={320}
      >
        <ConfigItems />
      </Page>
    </ConfigPageStoreProvider>
  );
}
