import type { DEPARTMENT_SELECTION_CHALLENGE_TYPE, DepartmentOption } from "~components";

// Augment the starter framework's `Register` interface so custom app state
// and login challenge renderers are typed by playground contracts.
declare module "@vef-framework-react/starter" {
  interface Register {
    appCustomState: {
      appId?: string;
    };
    challenges: {
      [DEPARTMENT_SELECTION_CHALLENGE_TYPE]: {
        data: { departments?: DepartmentOption[] };
        // The user's chosen department id.
        response: string;
      };
    };
  }
}
