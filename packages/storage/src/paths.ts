import { homedir } from "node:os";
import { join } from "node:path";

export function defaultConfigDir(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "chief-of-staff");
}
