import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { FlexCard, Page, Stack, Text, Title } from "@vef-framework-react/components";

export const Route = createFileRoute("/_layout/")({
  component: IndexPage
});

function IndexPage(): ReactNode {
  return (
    <Page scrollable scrollMargin>
      <FlexCard>
        <Stack>
          <Title level={3}>欢迎使用 VEF Framework</Title>

          <Text type="secondary">
            这是脚手架生成的首页。在 src/pages 下新增 route 文件即可添加页面。
          </Text>
        </Stack>
      </FlexCard>
    </Page>
  );
}
