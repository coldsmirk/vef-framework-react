import { Flex, Tag, Text } from "@vef-framework-react/components";

import { displayInstanceTitle } from "./format";

export function InstanceListTitle({
  title,
  instanceNo,
  unread
}: { title: string; instanceNo: string; unread?: boolean }) {
  const label = displayInstanceTitle(title, instanceNo);
  const showNumber = label !== instanceNo;
  return (
    <Flex vertical gap={2}>
      <Flex align="center" gap="small">
        <Text copyable={!showNumber} strong={unread}>{label}</Text>
        {unread && <Tag color="processing">未读</Tag>}
      </Flex>

      {showNumber && <Text copyable style={{ fontSize: 12 }} type="secondary">{instanceNo}</Text>}
    </Flex>
  );
}
