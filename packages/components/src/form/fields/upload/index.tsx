import type { StoredFileValue } from "../../../file-upload";
import type { UploadFieldProps } from "./props";

import { StoredFileUpload } from "../../../file-upload";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

/**
 * Binds the shared {@link StoredFileUpload} core to the surrounding form
 * field. Everything about storage keys — hydration, registry name lookup, the
 * single-vs-multi value shape — lives in that core, so this wrapper is only
 * the value binding.
 */
function UploadComponent(props: UploadFieldProps) {
  const {
    state: { value },
    handleChange
  } = useFieldContext<StoredFileValue>();

  return <StoredFileUpload {...props} value={value} onChange={handleChange} />;
}

export const UploadField = withFormItem("UploadField", UploadComponent);

export { type UploadFieldProps } from "./props";
