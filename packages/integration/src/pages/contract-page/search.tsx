import type { ContractSearch } from "../../types";

import { Col, Labeled, LabelsEditor, Row, useFormContext } from "@vef-framework-react/components";

/**
 * The inline search fields for the contract list.
 */
export function ContractSearchFields() {
  const { AppField } = useFormContext<ContractSearch>();

  return (
    <>
      <AppField name="code">{field => <field.Input allowClear noWrapper placeholder="契约编码" />}</AppField>
      <AppField name="name">{field => <field.Input allowClear noWrapper placeholder="契约名称" />}</AppField>
    </>
  );
}

/**
 * Label filters for the contract list, shown in the expandable search panel.
 *
 * Lives in the advanced panel rather than the inline bar because it is a
 * multi-row key/value editor, and because the backend ANDs every pair — a
 * filter that narrows this aggressively should not sit where it can be set by
 * accident. The same `LabelsEditor` the contract form uses is reused here so
 * the two places behave identically (empty-key rows dropped, out-of-charset
 * keys flagged inline).
 */
export function ContractAdvancedSearchFields() {
  const { AppField } = useFormContext<ContractSearch>();

  return (
    <Row gutter={["var(--vef-spacing-md)", "var(--vef-spacing-md)"]}>
      <Col xs={24}>
        <AppField name="labels">
          {field => (
            <Labeled
              hint="每对都要相等才命中(多对之间是「且」)；未打标签的契约不会出现在结果里"
              label="标签"
            >
              <LabelsEditor
                value={field.state.value}
                onChange={field.handleChange}
              />
            </Labeled>
          )}
        </AppField>
      </Col>
    </Row>
  );
}
