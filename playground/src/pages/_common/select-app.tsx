import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Card, Center, Stack, Text, Title } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { useAppStore } from "@vef-framework-react/starter";
import { useCallback } from "react";
import { APPS } from "~helpers";

const gridStyle = css({
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))"
});

export const Route = createFileRoute("/_common/select-app")({
  validateSearch: z.object({
    // eslint-disable-next-line unicorn/prefer-top-level-await -- `.catch` here is the zod fallback, not Promise#catch.
    redirect: z.string().optional().default("/").catch("/")
  }),
  component: SelectAppPage
});

function SelectAppPage(): ReactNode {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const handleSelect = useCallback(
    async (appId: string) => {
      useAppStore.setState(state => {
        state.custom.appId = appId;
      });
      // Force the layout loader (which is keyed on the previous appId) to
      // re-run with the freshly written value. `staleTime: Infinity` plus
      // `shouldReload: false` on the layout route mean a plain navigate
      // would reuse the cached user info for the old app.
      await router.invalidate();
      await navigate({ to: redirect, replace: true });
    },
    [navigate, redirect, router]
  );

  return (
    <Center css={{
      height: "100%",
      padding: 24,
      overflow: "auto"
    }}
    >
      <Stack css={{ width: "100%", maxWidth: 768 }} gap="large">
        <Title level={4} style={{ margin: 0, textAlign: "center" }}>请选择要进入的应用</Title>

        <div css={gridStyle}>
          {APPS.map(app => (
            <Card
              key={app.id}
              hoverable
              title={app.name}
              onClick={() => handleSelect(app.id)}
            >
              <Text type="secondary">{app.description}</Text>
            </Card>
          ))}
        </div>
      </Stack>
    </Center>
  );
}
