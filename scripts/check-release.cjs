const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
const issues = [];
function httpsUrl(name, value) {
  try { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); return url; }
  catch { issues.push(`${name}: valid public HTTPS URL required`); return null; }
}
const api = httpsUrl("production API", eas.build.production.env.EXPO_PUBLIC_API_BASE_URL);
if (api && /(^|[.-])(stg|staging|localhost)([.-]|$)/i.test(api.hostname)) issues.push("Production API points to a test environment");
httpsUrl("EXPO_PUBLIC_PRIVACY_POLICY_URL", process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
httpsUrl("EXPO_PUBLIC_TERMS_URL", process.env.EXPO_PUBLIC_TERMS_URL);
httpsUrl("ACCOUNT_DELETION_URL", process.env.ACCOUNT_DELETION_URL);
if (issues.length) { console.error(issues.join("\n")); process.exitCode = 1; }
else console.log("Release configuration checks passed. Backend, store disclosures and device/payment testing still require verification.");
