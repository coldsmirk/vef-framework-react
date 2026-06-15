import type { ExpressionEngine } from "../engine/loader";

import { createContext } from "react";

export const ExpressionEngineContext = createContext<ExpressionEngine | null>(null);
