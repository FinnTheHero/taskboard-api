import { registerEmailObserver } from "./observers/email.observer.js";
import { registerInAppObserver } from "./observers/in-app.observer.js";

export function registerObservers(): void {
  registerEmailObserver();
  registerInAppObserver();
  console.log("Observers registered: email, in-app");
}
