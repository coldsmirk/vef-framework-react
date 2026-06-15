import type { GetRef, PropsWithRef } from "../_base";
import type { GenericSelectPopupApi, GenericSelectProps, GenericSelectRef } from "./props";

import { useLatest } from "@vef-framework-react/hooks";
import { Select as SelectInternal } from "antd";
import { Search as SearchIcon } from "lucide-react";
import { useCallback, useDeferredValue, useImperativeHandle, useRef, useState } from "react";

import { styles } from "../_base";
import { Icon } from "../icon";

const searchSuffix = <Icon component={SearchIcon} />;

/**
 * The abstract base for popup-driven selection controls — the antd `Select`
 * trigger with its dropdown body swapped for an arbitrary surface. It owns the
 * styled trigger (selected-value display, size/status/variant/clear/disabled),
 * the controlled open state, the in-trigger search box, and the popup container;
 * concrete components supply only {@link GenericSelectProps.renderPopup} (the
 * popup body) and {@link GenericSelectProps.renderLabel} (how a value renders).
 *
 * It is the foundation the {@link IconPicker} builds on, and is published so
 * downstream code can build its own popup selects (e.g. a dropdown data table).
 */
export function GenericSelect<TValue extends string | number = string>({
  ref,
  value,
  onChange,
  onBlur,
  open,
  defaultOpen = false,
  onOpenChange,
  renderPopup,
  renderLabel,
  searchable = true,
  placeholder,
  size = "medium",
  status,
  variant = "outlined",
  disabled = false,
  allowClear = false,
  loading = false,
  suffixIcon,
  prefix,
  getPopupContainer,
  popupMatchSelectWidth = false,
  popupClassName,
  className,
  style
}: PropsWithRef<GenericSelectRef, GenericSelectProps<TValue>>) {
  const selectRef = useRef<GetRef<typeof SelectInternal>>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [keyword, setKeyword] = useState("");
  // Defer the keyword the popup filters against so typing stays responsive even
  // when the body re-renders a large, expensive list.
  const deferredKeyword = useDeferredValue(keyword);

  const isOpenControlled = open !== undefined;
  const isOpen = isOpenControlled ? open : uncontrolledOpen;

  useImperativeHandle(ref, () => {
    return {
      focus: () => selectRef.current?.focus(),
      blur: () => selectRef.current?.blur()
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!isOpenControlled) {
      setUncontrolledOpen(next);
    }

    // Reset the keyword on close so the popup reopens unfiltered.
    if (!next) {
      setKeyword("");
    }

    onOpenChange?.(next);
  };

  // Hand the popup body STABLE `select` / `close` callbacks (latest props read
  // through a ref) so a memoized body — e.g. the icon grid — is not re-rendered
  // on every keystroke merely because these closures changed identity.
  const onChangeRef = useLatest(onChange);
  const handleOpenChangeRef = useLatest(handleOpenChange);
  const select = useCallback((next: TValue) => onChangeRef.current?.(next), [onChangeRef]);
  const close = useCallback(() => handleOpenChangeRef.current(false), [handleOpenChangeRef]);

  const popupApi: GenericSelectPopupApi<TValue> = {
    value: value ?? null,
    keyword: deferredKeyword,
    open: isOpen,
    select,
    close
  };

  return (
    <SelectInternal<TValue>
      ref={selectRef}
      allowClear={allowClear}
      className={className}
      classNames={popupClassName ? { popup: { root: popupClassName } } : undefined}
      css={styles.fullWidth}
      disabled={disabled}
      getPopupContainer={getPopupContainer}
      labelRender={renderLabel ? ({ value: labelValue }) => renderLabel(labelValue as TValue) : undefined}
      loading={loading}
      open={isOpen}
      placeholder={placeholder}
      popupMatchSelectWidth={popupMatchSelectWidth}
      popupRender={() => <>{renderPopup(popupApi)}</>}
      prefix={prefix}
      showSearch={searchable ? { searchValue: keyword, onSearch: setKeyword } : false}
      size={size}
      status={status}
      style={style}
      suffixIcon={searchable && isOpen ? searchSuffix : suffixIcon}
      value={value ?? undefined}
      variant={variant}
      onBlur={onBlur}
      onClear={() => onChange?.(null)}
      onOpenChange={handleOpenChange}
    />
  );
}

export type {
  GenericSelectPopupApi,
  GenericSelectProps,
  GenericSelectRef,
  GenericSelectStatus,
  GenericSelectVariant
} from "./props";
