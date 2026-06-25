// commitlint is fully covered by canon — no framework-specific commit rules — so
// this is a straight re-export. Kept as a module (rather than dropping it) so the
// dev package stays the single toolchain facade consumers import from.
export { defineCommitlintConfig } from "@coldsmirk/commitlint-config";
