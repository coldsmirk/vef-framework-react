import { pinFrameworkDependencies, setEnvVar, toValidPackageName } from "./init";

describe("toValidPackageName", () => {
  it("lowercases the name and replaces spaces with hyphens", () => {
    expect(toValidPackageName("My Cool App")).toBe("my-cool-app");
  });

  it("strips leading dots and underscores", () => {
    expect(toValidPackageName("._hidden")).toBe("hidden");
  });

  it("replaces disallowed characters with a single hyphen", () => {
    expect(toValidPackageName("Foo@Bar!")).toBe("foo-bar");
  });

  it("trims hyphens introduced at the edges", () => {
    expect(toValidPackageName(" spaced ")).toBe("spaced");
  });
});

describe("pinFrameworkDependencies", () => {
  it("rewrites a framework dependency to the given version", () => {
    const manifest = {
      dependencies: { "@vef-framework-react/core": "^2.0.0", react: "^19.0.0" }
    };

    pinFrameworkDependencies(manifest, "2.5.0");

    expect(manifest.dependencies["@vef-framework-react/core"]).toBe("2.5.0");
  });

  it("leaves non-framework dependencies untouched", () => {
    const manifest = {
      dependencies: { react: "^19.0.0" },
      devDependencies: { vite: "^8.0.0" }
    };

    pinFrameworkDependencies(manifest, "2.5.0");

    expect(manifest.dependencies.react).toBe("^19.0.0");
    expect(manifest.devDependencies.vite).toBe("^8.0.0");
  });

  it("pins framework devDependencies as well", () => {
    const manifest = {
      devDependencies: { "@vef-framework-react/dev": "^2.0.0" }
    };

    pinFrameworkDependencies(manifest, "2.5.0");

    expect(manifest.devDependencies["@vef-framework-react/dev"]).toBe("2.5.0");
  });

  it("tolerates a manifest without dependency fields", () => {
    expect(() => pinFrameworkDependencies({}, "2.5.0")).not.toThrow();
  });
});

describe("setEnvVar", () => {
  it("replaces the value of the anchored key", () => {
    expect(setEnvVar("VEF_APP_NAME=old\nVEF_APP_TITLE=keep", "VEF_APP_NAME", "new"))
      .toBe("VEF_APP_NAME=new\nVEF_APP_TITLE=keep");
  });

  it("writes values containing $ sequences literally", () => {
    expect(setEnvVar("VEF_APP_TITLE=old", "VEF_APP_TITLE", "Acme $1 & $&"))
      .toBe("VEF_APP_TITLE=Acme $1 & $&");
  });

  it("leaves content unchanged when the key is absent", () => {
    expect(setEnvVar("OTHER=x", "VEF_APP_NAME", "new")).toBe("OTHER=x");
  });
});
