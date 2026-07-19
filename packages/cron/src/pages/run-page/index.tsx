import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";

import type { Run, RunSearch } from "../../types";
import type { CronRunPageProps } from "./props";

import { Button, CrudPage } from "@vef-framework-react/components";
import { useState } from "react";

import { useRunApi } from "../../api";
import { runColumns } from "./columns";
import { RunDetailDrawer } from "./detail";
import { RunSearchFields } from "./search";

type RunSceneValues = CrudBasicSceneFormValues<Record<string, never>, Record<string, never>>;

/**
 * Full-page, read-only browser over the cron run journal. Rows open a detail
 * drawer (also via the 详情 action) carrying the complete error text.
 */
export function CronRunPage({ columnStorageKey = "cron.run", title }: CronRunPageProps) {
  const api = useRunApi();
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <>
      <CrudPage<Run, RunSearch, RunSceneValues>
        basicSearch={<RunSearchFields />}
        columnSettings={{ storageKey: columnStorageKey }}
        operationColumn={{ width: 80, render: row => <Button size="small" type="link" onClick={() => setDetailId(row.id)}>详情</Button> }}
        queryFn={api.findPage}
        rowKey="id"
        tableColumns={runColumns}
        title={title}
        onRowClick={row => setDetailId(row.id)}
      />

      <RunDetailDrawer runId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
