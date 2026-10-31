import { takeRegistrationCallback } from "../core/registrationCallback";
export async function mountLocalAccountApp(container: HTMLElement) {
  // Strip credentials before importing App/routes or any telemetry module.
  const callback = takeRegistrationCallback(window.location, window.history);
  const { mountLocalAccountRoot } = await import("./localAccountRoot");
  mountLocalAccountRoot(container, callback);
}
