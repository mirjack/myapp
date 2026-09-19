const PAYCOM_HOSTS = new Set(["checkout.paycom.uz", "checkout.test.paycom.uz", "test.paycom.uz"]);

export function buildPaymentRedirectUrl(checkoutUrl, fields = {}, method = "POST") {
  const url = new URL(String(checkoutUrl || ""));
  if (url.protocol !== "https:" || !PAYCOM_HOSTS.has(url.hostname) || url.username || url.password || url.port) {
    throw new Error("Invalid payment destination");
  }
  if (method === "GET") return url.toString();
  if (method !== "POST" || !fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("Invalid payment fields");
  }
  const names = { merchant: "m", amount: "a", lang: "l", callback: "c", callback_timeout: "ct", currency: "cr" };
  const params = [];
  let hasMerchant = false, hasAmount = false, hasAccount = false;
  for (const [name, raw] of Object.entries(fields)) {
    const account = name.match(/^account\[([a-zA-Z0-9_]+)\]$/);
    const key = Object.hasOwn(names, name) ? names[name] : (account ? `ac.${account[1]}` : null);
    // Do not silently discard fiscal receipt fields unsupported by this GET adapter.
    if (!key || !["string", "number"].includes(typeof raw)) throw new Error("Unsupported payment field");
    const value = String(raw);
    if (!value || /[;\r\n]/.test(value)) throw new Error("Invalid payment value");
    if (key === "a" && (!/^\d+$/.test(value) || Number(value) <= 0)) throw new Error("Invalid payment amount");
    hasMerchant ||= key === "m";
    hasAmount ||= key === "a";
    hasAccount ||= Boolean(account);
    params.push(`${key}=${value}`);
  }
  if (!hasMerchant || !hasAmount || !hasAccount) throw new Error("Incomplete payment fields");
  const bytes = encodeURIComponent(params.join(";")).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return `${url.origin}/${btoa(bytes)}`;
}
