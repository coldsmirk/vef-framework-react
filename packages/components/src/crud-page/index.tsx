import type { AnyObject } from "@vef-framework-react/shared";

import type { CrudPageProps } from "./props";

import { Crud } from "../crud";
import { Page } from "../page";

export function CrudPage<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject = never
>({
  leftAside,
  leftAsideWidth,
  rightAside,
  rightAsideWidth,
  header,
  headerClassName,
  headerPosition,
  footer,
  footerClassName,
  footerPosition,
  ...crudProps
}: CrudPageProps<TRow, TSearchValues, TSceneFormValues, TParams>) {
  return (
    <Page
      margin
      footer={footer}
      footerClassName={footerClassName}
      footerPosition={footerPosition}
      header={header}
      headerClassName={headerClassName}
      headerPosition={headerPosition}
      leftAside={leftAside}
      leftAsideWidth={leftAsideWidth}
      rightAside={rightAside}
      rightAsideWidth={rightAsideWidth}
    >
      <Crud<TRow, TSearchValues, TSceneFormValues, TParams> {...crudProps} />
    </Page>
  );
}

export type { CrudPageProps } from "./props";
