import type { LoginChallengeRenderers, LoginParams, ResolveChallengeParams } from "@vef-framework-react/starter";

import { createFileRoute } from "@tanstack/react-router";
import { createLoginRouteOptions } from "@vef-framework-react/starter";
import { apiClient } from "~api";
import { login, resolveChallenge } from "~apis";
import { DEPARTMENT_SELECTION_CHALLENGE_TYPE, DepartmentSelectionChallenge } from "~components";

function handleLogin(params: LoginParams) {
  return apiClient.executeMutation({ mutationFn: login, params });
}

function handleResolveChallenge(params: ResolveChallengeParams) {
  return apiClient.executeMutation({ mutationFn: resolveChallenge, params });
}

// `LoginChallengeRenderers` is keyed off the augmented `Register['challenges']`
// (see `playground/src/types/augmentation.ts`), so adding a new
// challenge type there forces a corresponding renderer entry here at compile
// time.
const challengeRenderers: LoginChallengeRenderers = {
  [DEPARTMENT_SELECTION_CHALLENGE_TYPE]: DepartmentSelectionChallenge
};

export const Route = createFileRoute("/_common/login")(
  createLoginRouteOptions({
    onLogin: handleLogin,
    onResolveChallenge: handleResolveChallenge,
    challengeRenderers
  })
);
