import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const output = join(process.cwd(), ".next", "standalone", "web");

function containsNativeBinding(directory: string): boolean {
  if (!existsSync(directory)) {
    return false;
  }
  return readdirSync(directory, { withFileTypes: true }).some((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? containsNativeBinding(path)
      : entry.name.endsWith(".node");
  });
}

function containsBetterSqliteBinding(directory: string): boolean {
  return readdirSync(directory, { withFileTypes: true }).some(
    (entry) =>
      entry.isDirectory() &&
      entry.name.startsWith("better-sqlite3@") &&
      containsNativeBinding(join(directory, entry.name)),
  );
}

function materializeWindowsLinks(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink() && lstatSync(path).isSymbolicLink()) {
      const target = resolve(dirname(path), readlinkSync(path));
      const targetIsDirectory = statSync(target).isDirectory();
      unlinkSync(path);
      cpSync(target, path, { recursive: targetIsDirectory });
      if (targetIsDirectory) {
        materializeWindowsLinks(path);
      }
      continue;
    }
    if (entry.isDirectory()) {
      materializeWindowsLinks(path);
    }
  }
}

function hoistWindowsPackages(nodeModules: string) {
  const hoisted = join(nodeModules, ".pnpm", "node_modules");
  for (const entry of readdirSync(hoisted)) {
    const source = join(hoisted, entry);
    const destination = join(nodeModules, entry);
    if (!existsSync(destination)) {
      cpSync(source, destination, {
        recursive: statSync(source).isDirectory(),
      });
    }
  }
}

for (const name of [".env", ".env.production", "data"]) {
  rmSync(join(output, name), { force: true, recursive: true });
}

cpSync(
  join(process.cwd(), ".next", "static"),
  join(output, ".next", "static"),
  {
    recursive: true,
  },
);

if (process.platform === "win32") {
  const standalone = join(process.cwd(), ".next", "standalone");
  materializeWindowsLinks(standalone);
  hoistWindowsPackages(join(standalone, "node_modules"));
}

if (
  !existsSync(join(output, "server.js")) ||
  !existsSync(join(output, "drizzle")) ||
  !containsBetterSqliteBinding(
    join(process.cwd(), ".next", "standalone", "node_modules", ".pnpm"),
  )
) {
  throw new Error("Standalone output is incomplete.");
}
