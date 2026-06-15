// Each module triggers `defineMock` at import time. Keep this barrel small —
// new modules just need a single side-effect import.

// Auth must register before any UI-mounted query fires.
import "./auth";
// sys-dictionary seeds the dictionary registry that other modules consume.
import "./sys-dictionary";
import "./sys-dictionary-item";
import "./md-department";
import "./md-district";
import "./md-id-mapping";
import "./md-organization";
import "./md-staff";
import "./sys-app";
import "./sys-audit-log";
import "./sys-config";
import "./sys-config-definition";
import "./sys-login-log";
import "./sys-menu";
import "./sys-monitor";
import "./sys-role";
import "./sys-serial-no-rule";
import "./sys-user";
