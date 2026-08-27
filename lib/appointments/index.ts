/**
 * The appointment domain.
 *
 * `docs/api-conventions.md` shows handlers importing from `@/lib/appointments`,
 * so this barrel is the public surface. The state machine in `transition.ts` is
 * the only path that writes `status`; nothing outside this directory should
 * reach for the Prisma model directly.
 */

export { createAppointment, type CreateAppointmentInput } from "./create";
export {
  assertTransitionAllowed,
  transitionAppointment,
  type Actor,
  type TransitionableAppointment,
  type TransitionInput,
} from "./transition";
export {
  getAppointmentFor,
  listAppointmentsFor,
  listUpcomingAppointmentsFor,
  type AppointmentListFilters,
} from "./queries";
export { resolveActor } from "./actor";
export {
  appointmentDateFromKey,
  appointmentInterval,
  endTimeFor,
  type AppointmentInterval,
} from "./time";
