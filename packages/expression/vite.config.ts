import { defineBuildConfig } from "../../scripts/build-config";
import packageJson from "./package.json";

export default defineBuildConfig({
  name: packageJson.name,
  version: packageJson.version,
  author: packageJson.author.name,
  useEmotion: false,
  entries: ["src/index.ts", "src/react/index.ts"],
  external: [
    ...Object.keys(packageJson.dependencies).map(dep => new RegExp(`^${dep}`)),
    ...Object.keys(packageJson.peerDependencies).map(dep => new RegExp(`^${dep}`))
  ]
});
