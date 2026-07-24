const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const expoStateDir = path.join(projectRoot, ".expo");
const isWindows = process.platform === "win32";
const envFilePath = path.join(projectRoot, ".env");

function readEnvValueFromFile(key) {
  try {
    if (!fs.existsSync(envFilePath)) return "";
    const content = fs.readFileSync(envFilePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;

      const currentKey = trimmed.slice(0, eqIndex).trim();
      if (currentKey !== key) continue;

      const rawValue = trimmed.slice(eqIndex + 1).trim();
      return rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    return "";
  }

  return "";
}

const mode = process.argv.includes("--dev-client") ? "dev-client" : "go";
const useTunnel = process.argv.includes("--tunnel");
const defaultPort = mode === "dev-client" ? "8080" : "8081";
const metroPort =
  process.env.EXPO_DEV_PORT || process.env.EXPO_GO_PORT || defaultPort;
const fileWebUrlOverride =
  readEnvValueFromFile("EXPO_WEB_URL") ||
  readEnvValueFromFile("EXPO_PUBLIC_WEB_URL") ||
  "";
const explicitWebUrlOverride =
  process.env.EXPO_WEB_URL ||
  process.env.EXPO_PUBLIC_WEB_URL ||
  fileWebUrlOverride ||
  "";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function getLanIpAddress() {
  const interfaces = os.networkInterfaces();
  const preferred = [];
  const fallback = [];

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.internal || address.family !== "IPv4") continue;

      if (
        address.address.startsWith("192.168.") ||
        address.address.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(address.address)
      ) {
        preferred.push(address.address);
      } else {
        fallback.push(address.address);
      }
    }
  }

  return preferred[0] || fallback[0] || null;
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: isWindows && command.toLowerCase().endsWith(".cmd"),
  });
}

function runCapture(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}

function cleanupExpoProcesses() {
  log("Cleaning stale Expo and Metro processes...");

  if (isWindows) {
    const script = `
      $targets = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'node.exe' -and $_.CommandLine -match 'expo start|metro'
      }
      foreach ($target in $targets) {
        try { Stop-Process -Id $target.ProcessId -Force -ErrorAction Stop } catch {}
      }
    `;

    run("powershell.exe", ["-NoProfile", "-Command", script]);
    return;
  }

  run("pkill", ["-f", "expo start|metro"]);
}

function cleanupTargetPort() {
  log(`Ensuring port ${metroPort} is free...`);

  if (isWindows) {
    const query = [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${metroPort} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ConvertTo-Json -Compress`,
    ];
    const result = runCapture("powershell.exe", query);
    const raw = (result.stdout || "").trim();
    if (!raw) return;

    let processIds = [];
    try {
      const parsed = JSON.parse(raw);
      processIds = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      processIds = raw
        .split(/\s+/)
        .map((value) => Number(value))
        .filter(Boolean);
    }

    for (const processId of processIds) {
      if (!processId) continue;
      run("powershell.exe", [
        "-NoProfile",
        "-Command",
        `try { Stop-Process -Id ${processId} -Force -ErrorAction Stop } catch {}`,
      ]);
    }

    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `$deadline = (Get-Date).AddSeconds(8); while ((Get-Date) -lt $deadline) { if (-not (Get-NetTCPConnection -LocalPort ${metroPort} -ErrorAction SilentlyContinue)) { exit 0 }; Start-Sleep -Milliseconds 250 }; exit 0`,
    ]);
    return;
  }

  run("pkill", ["-f", `:${metroPort}`]);
}

function clearExpoState() {
  if (!fs.existsSync(expoStateDir)) return;
  log("Removing cached .expo state...");
  fs.rmSync(expoStateDir, { recursive: true, force: true });
}

function startExpo() {
  const env = { ...process.env };
  const args = ["expo", "start", "-c"];

  if (mode === "dev-client") {
    args.push("--dev-client");
  } else {
    args.push("--go");
  }

  if (useTunnel) {
    log(`Starting Expo ${mode} in tunnel mode...`);
    args.push("--tunnel");
  } else {
    const lanIpAddress = getLanIpAddress();

    if (!lanIpAddress) {
      throw new Error(
        "No IPv4 LAN address was found. Connect to Wi-Fi/Ethernet or use tunnel mode."
      );
    }

    const resolvedWebUrl =
      explicitWebUrlOverride || `http://${lanIpAddress}:80/`;
    const webUrlSource = process.env.EXPO_WEB_URL || process.env.EXPO_PUBLIC_WEB_URL
      ? "shell env"
      : fileWebUrlOverride
        ? ".env"
        : "LAN fallback";

    env.EXPO_PACKAGER_PROXY_URL = `http://${lanIpAddress}:${metroPort}`;
    env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIpAddress;
    env.EXPO_PUBLIC_WEB_URL = resolvedWebUrl;

    log(
      `Starting Expo ${mode} on ${lanIpAddress}:${metroPort} with WebView base ${resolvedWebUrl} (${webUrlSource})`
    );

    args.push("--host", "lan", "--port", metroPort);
  }

  const command = isWindows ? "npx.cmd" : "npx";
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env,
    shell: isWindows,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

try {
  cleanupExpoProcesses();
  cleanupTargetPort();
  clearExpoState();
  startExpo();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
