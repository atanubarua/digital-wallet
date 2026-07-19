export { createLoggingModule } from "./logging.module";
// Re-exported so consuming services import `Logger` from HERE, never
// directly from "nestjs-pino" themselves. pnpm's per-package dependency
// resolution can install "nestjs-pino" as physically distinct package
// instances for service-kit vs. a consuming app (its peer-dependency
// resolution can diverge across packages) - if a consumer imported `Logger`
// from its OWN copy while createLoggingModule() (running inside
// service-kit) registered a `Logger` provider from A DIFFERENT copy,
// Nest's DI (which matches providers by exact class reference) would fail
// to find it - exactly the "Logger element does not exist in the current
// context" error hit during Phase 0 verification. Routing every consumer
// through this single re-export guarantees the class reference used to
// register the provider and the one used to retrieve it are the same
// object, by construction.
export { Logger } from "nestjs-pino";
