import { ensureNotificationSetupAsync } from "@/lib/notifications";

/**
 * Ilova ishga tushganda bajariladigan native bootstrap ishlarini bir joyda
 * saqlaydi. Root layout routing va navigation konfiguratsiyasiga fokuslanadi.
 */
export function initializeAppAsync() {
  return ensureNotificationSetupAsync({
    requestIfUndetermined: true,
  });
}
