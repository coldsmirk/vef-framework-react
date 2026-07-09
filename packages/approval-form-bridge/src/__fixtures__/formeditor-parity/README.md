# formeditor parity fixtures

Byte-verbatim copies of the Go parser's golden fixtures. The source of truth lives in the
`vef-framework-go` repository at `internal/approval/formeditor/testdata/` — that package is the
enforcement-side twin of this package's `projectFormSchema`, and these fixtures pin the parity
between the two implementations.

- `<name>.schema.json` — a rich form-editor `FormSchema` document (the deploy input).
- `<name>.expected.json` — the flat `ApprovalFormField[]` both sides must derive from it.
- A `<name>.schema.json` without an expected file is an error fixture: the Go parser rejects it,
  and `projectFormSchema` must report at least one error-severity issue (`valid === false`).

The two fixture sets MUST be updated together: any change to the projection semantics lands in
both repositories with the same fixture diff. Never hand-edit or reformat the copies here —
re-copy from the Go testdata directory instead. `project.parity.test.ts` consumes this directory.
