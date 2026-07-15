import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Page, Stack, Text, Title, Upload } from "@vef-framework-react/components";
import { alwaysFalse } from "@vef-framework-react/shared";

export const Route = createFileRoute("/_layout/sys/file-preview-demo")({
  component: FilePreviewDemoPage
});

function FilePreviewDemoPage(): ReactNode {
  return (
    <Page scrollable>
      <Stack gap="medium">
        <Title level={4}>文件预览桥接</Title>

        <Text type="secondary">
          框架不内置任何预览实现。本应用在认证布局外层安装了基于 @file-viewer/react 的预览宿主
          (代码见 src/components/file-viewer-preview-host.tsx,挂载点见 src/pages/_layout/route.tsx),
          全局所有 Upload / FileUpload / UploadField 的非图片文件都会被归一化为 FilePreviewTarget
          派发给它;存储对象经 HttpClient.requestFile() 携带认证取流,本地文件直接用其字节。
        </Text>

        <Text type="secondary">
          选择本地 PDF / Word / Excel / PPT / OFD 文件(不会真正上传),点击列表中的文件名即可预览。
          图片仍走内置 Image 预览;office preset 之外的格式回落为浏览器打开或提示。
        </Text>

        <Upload multiple beforeUpload={alwaysFalse} />
      </Stack>
    </Page>
  );
}
