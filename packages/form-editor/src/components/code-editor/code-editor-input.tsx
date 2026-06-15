// The dynamic-import boundary for the code-editor field: this module is the
// only static importer of the components CodeEditor on the field path, so an
// app bundler splits CodeMirror into the async chunk this file anchors.
export { CodeEditor as CodeEditorInput } from "@vef-framework-react/components";
