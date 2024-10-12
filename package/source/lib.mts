import path from "node:path";
import fs from "node:fs/promises";
import childProcess from "node:child_process";
import util from "node:util";
import fsStream from "node:fs";
import stream from "node:stream/promises";
import archiver from "archiver";
import { dedent as batch } from "@radically-straightforward/utilities";
import { dedent as sh } from "@radically-straightforward/utilities";

/**
 * Options for packaging an application into an executable
 */
export type PackageAppOptions = {
  /**
   * Executable entry.
   * Defaults to "build/index.mjs"
   */
  entry: string;
  /**
   * Whether to skip the deduplication step
   * Defaults to false
  */
  skipDedupe: boolean;
  /**
   * Package manager to use
   * Defaults to "npm"
  */
  packageManager: "npm" | "yarn" | "pnpm";
};

/**
 * Package an application into an executable
 * @param givenOptions - Additional options for packaging the application
 */
export async function packageApp(givenOptions: Partial<PackageAppOptions>) {
  const options: PackageAppOptions = {
    entry: "build/index.mjs",
    skipDedupe: false,
    packageManager: "npm",
    ...givenOptions,
  };

  if (!options.skipDedupe) {
    await util.promisify(childProcess.exec)(
      `${options.packageManager}${process.platform === "win32" ? ".cmd" : ""} dedupe`,
      { env: { ...process.env, NODE_ENV: "production" } },
    );
  }

  await fs.mkdir("./node_modules/.bin", { recursive: true });
  await fs.cp(
    process.execPath,
    path.join("./node_modules/.bin", path.basename(process.execPath)),
  );

  const archive =
    process.platform === "win32"
      ? archiver("zip")
      : archiver("tar", { gzip: true });
  const archiveStream = fsStream.createWriteStream(
    path.join(
      `../${path.basename(process.cwd())}.${process.platform === "win32" ? "zip" : "tar.gz"
      }`,
    ),
  );
  archive.pipe(archiveStream);
  archive.directory(".", `${path.basename(process.cwd())}/_/`);
  if (process.platform === "win32")
    archive.append(
      batch`
      @echo off
      set PACKAGE=%~dp0_
      "%PACKAGE%/node_modules/.bin/node" "%PACKAGE%/${options.entry}" %*
    `,
      {
        name: `${path.basename(process.cwd())}/${path.basename(
          process.cwd(),
        )}.cmd`,
      },
    );
  else
    archive.append(
      sh`
      #!/usr/bin/env sh
      export PACKAGE="$(dirname "$0")/_"
      exec "$PACKAGE/node_modules/.bin/node" "$PACKAGE/${options.entry}" "$@"
    `,
      {
        name: `${path.basename(process.cwd())}/${path.basename(process.cwd())}`,
        mode: 0o755,
      },
    );
  await archive.finalize();
  await stream.finished(archiveStream);
}