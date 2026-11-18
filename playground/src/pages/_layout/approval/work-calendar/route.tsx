import { createFileRoute } from "@tanstack/react-router";
import { WorkCalendarPage } from "@vef-framework-react/calendar";

export const Route = createFileRoute("/_layout/approval/work-calendar")({ component: WorkCalendarPage });
