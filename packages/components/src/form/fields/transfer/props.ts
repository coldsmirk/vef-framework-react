import type { Except } from "@vef-framework-react/shared";

import type { TransferProps } from "../../../transfer";

export interface TransferFieldProps extends Except<TransferProps, "targetKeys" | "onChange"> {
}
