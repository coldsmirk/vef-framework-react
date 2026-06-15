import type { FieldOptionSource, RemoteDataSourceRequest } from "../../../../types";

export type OptionSourceKind = FieldOptionSource["kind"];

const EMPTY_REQUEST: RemoteDataSourceRequest = { resource: "", action: "" };

/**
 * Switch a {@link FieldOptionSource} to a different kind, preserving the inner
 * payload when the kind is unchanged so a user does not lose their work toggling
 * the segmented control.
 */
export function setOptionSourceKind(
  current: FieldOptionSource | undefined,
  kind: OptionSourceKind
): FieldOptionSource {
  switch (kind) {
    case "static": {
      return { kind: "static", options: current?.kind === "static" ? current.options : [] };
    }

    case "ref": {
      return { kind: "ref", dataSourceId: current?.kind === "ref" ? current.dataSourceId : "" };
    }

    case "remote": {
      return current?.kind === "remote"
        ? current
        : { kind: "remote", request: { ...EMPTY_REQUEST } };
    }
  }
}

/**
 * Whether an option source carries payload worth confirming before a
 * destructive kind switch discards it (`setOptionSourceKind` keeps the payload
 * only when the kind is unchanged).
 */
export function optionSourceHasPayload(source: FieldOptionSource): boolean {
  switch (source.kind) {
    case "static": {
      return source.options.length > 0;
    }

    case "ref": {
      return source.dataSourceId.length > 0;
    }

    case "remote": {
      return source.request.resource.length > 0
        || source.request.action.length > 0
        || source.mapping !== undefined;
    }
  }
}
