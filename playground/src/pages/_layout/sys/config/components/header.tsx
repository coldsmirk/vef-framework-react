import type { ReactNode } from "react";

import { SearchOutlined } from "@ant-design/icons";
import { Button, Group, Icon, Input } from "@vef-framework-react/components";
import { useShallow } from "@vef-framework-react/core";
import { useHasMutating } from "@vef-framework-react/hooks";
import { CheckIcon } from "lucide-react";
import { saveConfigs } from "~apis";

import { useConfigPageStore } from "../store";
import classes from "../styles/index.module.scss";

export function Header(): ReactNode {
  const {
    eventEmitter,
    keyword,
    setKeyword
  } = useConfigPageStore(
    useShallow(state => {
      return {
        eventEmitter: state.eventEmitter,
        keyword: state.keyword,
        setKeyword: state.setKeyword
      };
    })
  );

  const isSubmitting = useHasMutating(saveConfigs.key);

  function handleSubmit(): void {
    eventEmitter.emit("submit");
  }

  return (
    <Group justify="space-between">
      <Input
        allowClear
        className={classes.searchInput}
        placeholder="搜索关键字"
        size="large"
        suffix={<SearchOutlined className="input-suffix-icon" />}
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
      />

      <Button
        icon={<Icon component={CheckIcon} />}
        loading={isSubmitting}
        type="primary"
        onClick={handleSubmit}
      >
        保存
      </Button>
    </Group>
  );
}
