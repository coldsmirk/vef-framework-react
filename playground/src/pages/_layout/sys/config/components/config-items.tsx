import type { ReactNode } from "react";
import type { ConfigDefinition } from "~apis";

import { Card, Empty, Loader, useForm, useViewportHeight } from "@vef-framework-react/components";
import { useMutation, useQuery, useShallow } from "@vef-framework-react/core";
import { useEmitterEvent } from "@vef-framework-react/hooks";
import { useDeferredValue, useMemo } from "react";
import { findConfigsByCategory, saveConfigs } from "~apis";

import { useConfigPageStore } from "../store";
import classes from "../styles/index.module.scss";
import { ConfigItemControl } from "./config-item-control";
import { ErrorMessage } from "./error-message";

type ConfigValues = Record<string, unknown>;

function escapeConfigKeys(values: ConfigValues): ConfigValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.replaceAll(".", ":"), value])
  );
}

function unescapeConfigKeys(values: ConfigValues): ConfigValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.replaceAll(":", "."), value])
  );
}

function filterConfigs(configs: ConfigDefinition[], keyword?: string): ConfigDefinition[] {
  if (!keyword) {
    return configs;
  }

  const lowerKeyword = keyword.toLowerCase();

  return configs.filter(config => config.name.toLowerCase().includes(lowerKeyword)
    || config.key.toLowerCase().includes(lowerKeyword)
    || config.description?.toLowerCase().includes(lowerKeyword));
}

export function ConfigItems(): ReactNode {
  const {
    eventEmitter,
    selectedCategory,
    keyword
  } = useConfigPageStore(
    useShallow(state => {
      return {
        eventEmitter: state.eventEmitter,
        selectedCategory: state.selectedCategory,
        keyword: state.keyword
      };
    })
  );

  const deferredKeyword = useDeferredValue(keyword);
  const viewportHeight = useViewportHeight();

  const configsResult = useQuery({
    queryKey: ["find_configs_by_category", { category: selectedCategory }],
    queryFn: findConfigsByCategory,
    enabled: Boolean(selectedCategory)
  });

  const filteredConfigs = useMemo<ConfigDefinition[]>(() => {
    const configs = configsResult.data?.configDefinitions;

    if (!configs) {
      return [];
    }

    return filterConfigs(configs, deferredKeyword);
  }, [configsResult.data?.configDefinitions, deferredKeyword]);

  const { mutate } = useMutation({
    mutationKey: [saveConfigs.key],
    mutationFn: saveConfigs
  });

  const {
    AppForm,
    Form,
    handleSubmit
  } = useForm({
    defaultValues: escapeConfigKeys(configsResult.data?.configValues ?? {}),
    onSubmit: ({ value }) => {
      mutate({
        category: selectedCategory!,
        configValues: unescapeConfigKeys(value)
      });
    }
  });

  useEmitterEvent(eventEmitter, "submit", handleSubmit);

  if (configsResult.isFetching) {
    return (
      <div className={classes.placeholder} style={{ height: viewportHeight }}>
        <Loader />
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div className={classes.placeholder} style={{ height: viewportHeight }}>
        <Empty description="请选择一个配置分类" />
      </div>
    );
  }

  if (filteredConfigs.length === 0) {
    return (
      <div className={classes.placeholder} style={{ height: viewportHeight }}>
        <Empty description="暂无配置项" />
      </div>
    );
  }

  return (
    <AppForm>
      <Form>
        <Card className={classes.configListCard}>
          {filteredConfigs.map(item => (
            <div key={item.id}>
              <div className={classes.configItem}>
                <div className={classes.configItemInfo}>
                  <span className={classes.configItemTitle}>{item.name}</span>

                  {item.description
                    && <span className={classes.configItemDesc}>{item.description}</span>}
                </div>

                <div className={classes.configItemControl}>
                  <ConfigItemControl
                    configKey={item.key}
                    isRequired={item.isRequired}
                    meta={item.meta}
                    valueType={item.valueType}
                  />
                </div>
              </div>

              <ErrorMessage configKey={item.key} />
            </div>
          ))}
        </Card>
      </Form>
    </AppForm>
  );
}
