import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import http from "node:http";
import stream from "node:stream/promises";
import timers from "node:timers/promises";
import busboy from "busboy";
import "@radically-straightforward/node";
import * as utilities from "@radically-straightforward/utilities";

export type Route = {
  method?: string | RegExp;
  pathname?: string | RegExp;
  error?: boolean;
  handler: (
    request: Request<{}, {}, {}, {}, {}>,
    Response: Response,
  ) => void | Promise<void>;
};

export type Request<Pathname, Search, Cookies, Body, State> =
  http.IncomingMessage & {
    id: string;
    start: bigint;
    log: (...messageParts: string[]) => void;
    ip: string;
    URL: URL;
    pathname: Pathname;
    search: Search;
    cookies: Cookies;
    body: Body;
    state: State;
    error?: unknown;
    liveConnection?: RequestLiveConnection;
  };

export type RequestBodyFile = busboy.FileInfo & { path: string };

export type RequestLiveConnection = {
  establish?: boolean;
  skipUpdateOnEstablish?: boolean;
};

export type Response = http.ServerResponse & {
  setCookie: (key: string, value: string, maxAge?: number) => Response;
  deleteCookie: (key: string) => Response;
  redirect: (
    destination?: string,
    type?: "see-other" | "temporary" | "permanent",
  ) => Response;
};

type LiveConnection = RequestLiveConnection & {
  request: Request<{}, {}, {}, {}, {}>;
  response: Response & { liveConnectionEnd?: () => void };
  writableEnded?: boolean;
  update?: () => void;
  deleteTimeout?: NodeJS.Timeout;
};

export default function server({
  port = 18000,
  csrfProtectionExceptionPathname = "",
}: {
  port?: number;
  csrfProtectionExceptionPathname?: string | RegExp;
} = {}): Route[] {
  const routes = new Array<Route>();
  const liveConnections = new Set<LiveConnection>();

  const httpServer = http
    .createServer((async (
      request: Request<
        { [key: string]: string },
        { [key: string]: string },
        { [key: string]: string },
        {
          [key: string]:
            | string
            | RequestBodyFile
            | string[]
            | RequestBodyFile[];
        },
        { [key: string]: unknown }
      > & { liveConnection?: LiveConnection },
      response: Response & { liveConnectionEnd?: () => void },
    ) => {
      try {
        request.id = utilities.randomString();

        request.start = process.hrtime.bigint();

        request.log = (...messageParts: string[]): void => {
          log(
            request.id,
            `${(process.hrtime.bigint() - request.start) / 1_000_000n}ms`,
            ...messageParts,
          );
        };

        request.ip = String(request.headers["x-forwarded-for"] ?? "127.0.0.1");

        request.log(
          "REQUEST",
          request.ip,
          request.method ?? "UNDEFINED",
          request.url ?? "UNDEFINED",
        );

        if (request.method === undefined || request.url === undefined)
          throw new Error("Missing request ‘method’ or ‘url’.");

        request.URL = new URL(
          request.url,
          `${request.headers["x-forwarded-proto"] ?? "http"}://${
            request.headers["x-forwarded-host"] ?? request.headers["host"]
          }`,
        );

        if (
          request.method !== "GET" &&
          request.headers["csrf-protection"] !== "true" &&
          ((typeof csrfProtectionExceptionPathname === "string" &&
            request.URL.pathname !== csrfProtectionExceptionPathname) ||
            (csrfProtectionExceptionPathname instanceof RegExp &&
              request.URL.pathname.match(csrfProtectionExceptionPathname) ===
                null))
        ) {
          response.statusCode = 403;
          throw new Error(
            "This request appears to have come from outside the application. Please close this tab and start again. (Cross-Site Request Forgery (CSRF) protection failed.)",
          );
        }

        request.search = Object.fromEntries(request.URL.searchParams);

        request.cookies = Object.fromEntries(
          (request.headers["cookie"] ?? "").split(";").flatMap((pair) => {
            if (pair.trim() === "") return [];
            const parts = pair
              .split("=")
              .map((part) => decodeURIComponent(part.trim()));
            if (parts.length !== 2 || parts.some((part) => part === ""))
              throw new Error("Malformed ‘Cookie’ header.");
            parts[0] = parts[0].replace(/^__Host-/, "");
            return [parts];
          }),
        );

        request.body = {};
        if (typeof request.headers["content-type"] === "string") {
          const directoriesToDelete = new Set<string>();
          response.once("close", async () => {
            for (const directoryToDelete of directoriesToDelete)
              await fs.rm(directoryToDelete, {
                recursive: true,
                force: true,
              });
          });
          const filesPromises = new Set<Promise<void>>();
          await new Promise<void>((resolve, reject) => {
            request.pipe(
              busboy({
                headers: request.headers,
                preservePath: true,
                limits: {
                  headerPairs: 200,
                  fields: 300,
                  fieldNameSize: 300,
                  fieldSize: 2 ** 20,
                  files: 100,
                  fileSize: 10 * 2 ** 20,
                },
              })
                .on("field", (name, value, information) => {
                  if (information.nameTruncated || information.valueTruncated) {
                    response.statusCode = 413;
                    reject(new Error("Field too large."));
                  }
                  if (name.endsWith("[]"))
                    (
                      (request.body[name.slice(0, -"[]".length)] ??= []) as (
                        | string
                        | RequestBodyFile
                      )[]
                    ).push(value);
                  else request.body[name] = value;
                })
                .on("file", (name, file, information) => {
                  if (information.filename.length > 200) {
                    response.statusCode = 413;
                    reject(new Error("File name too large."));
                  }
                  const value = {
                    ...information,
                    path: path.join(
                      os.tmpdir(),
                      `server--file--${utilities.randomString()}`,
                      information.filename.trim() === ""
                        ? "file"
                        : information.filename
                            .replace(/[^A-Za-z0-9\-_\.]/gu, "-")
                            .toLowerCase(),
                    ),
                  };
                  if (name.endsWith("[]"))
                    (
                      (request.body[name.slice(0, -"[]".length)] ??= []) as (
                        | string
                        | RequestBodyFile
                      )[]
                    ).push(value);
                  else request.body[name] = value;
                  filesPromises.add(
                    (async (): Promise<void> => {
                      directoriesToDelete.add(path.dirname(value.path));
                      await fs.mkdir(path.dirname(value.path));
                      await fs.writeFile(value.path, file);
                      // @ts-expect-error: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68985
                      if (file.truncated) {
                        response.statusCode = 413;
                        throw new Error("File too large.");
                      }
                    })(),
                  );
                })
                .on("close", () => {
                  resolve();
                })
                .on("fieldsLimit", () => {
                  response.statusCode = 413;
                  reject(new Error("Too many fields."));
                })
                .on("filesLimit", () => {
                  response.statusCode = 413;
                  reject(new Error("Too many files."));
                })
                .on("error", (error) => {
                  reject(error);
                }),
            );
          });
          await Promise.all(filesPromises);
        }

        if (process.env.NODE_ENV !== "production" && request.method !== "GET")
          request.log(JSON.stringify(request.body, undefined, 2));
      } catch (error) {
        request.log("ERROR", String(error));
        if (response.statusCode === 200) response.statusCode = 400;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(String(error));
      }

      if (!response.writableEnded) {
        if (request.method === "GET" && request.URL.pathname === "/_health")
          response.end();
        else if (request.method === "GET" && request.URL.pathname === "/_proxy")
          try {
            if (typeof request.search.destination !== "string") {
              response.statusCode = 422;
              throw new Error("Missing ‘destination’ search parameter.");
            }

            let destination: URL;
            try {
              destination = new URL(request.search.destination);
            } catch (error) {
              response.statusCode = 422;
              throw new Error("Invalid destination.");
            }
            if (
              (destination.protocol !== "http:" &&
                destination.protocol !== "https:") ||
              destination.hostname === request.URL.hostname
            ) {
              response.statusCode = 422;
              throw new Error("Invalid destination.");
            }

            const destinationResponse = await fetch(destination.href, {
              signal: AbortSignal.timeout(30 * 1000),
            });
            const destinationResponseContentType =
              destinationResponse.headers.get("Content-Type");
            if (
              !destinationResponse.ok ||
              typeof destinationResponseContentType !== "string" ||
              destinationResponseContentType.match(
                new RegExp("^(?:image|video|audio)/"),
              ) === null ||
              !(destinationResponse.body instanceof ReadableStream)
            )
              throw new Error("Invalid destination response.");

            response.setHeader("Content-Type", destinationResponseContentType);
            // @ts-expect-error: https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/68986
            await stream.pipeline(destinationResponse.body, response, {
              signal: AbortSignal.timeout(5 * 60 * 1000),
            });
          } catch (error) {
            request.log("ERROR", String(error));
            if (!response.headersSent) {
              if (response.statusCode === 200) response.statusCode = 502;
              response.setHeader("Content-Type", "text/plain; charset=utf-8");
            }
            if (!response.writableEnded) response.end(String(error));
          }
        else if (
          request.ip === "127.0.0.1" &&
          request.method === "POST" &&
          request.URL.pathname === "/__live-connections"
        )
          try {
            if (
              typeof request.body.pathname !== "string" ||
              request.body.pathname.trim() === ""
            )
              throw new Error("Invalid ‘pathname’.");
            response.once("close", async () => {
              for (const liveConnection of liveConnections) {
                if (
                  liveConnection.request.URL.pathname.match(
                    new RegExp(request.body.pathname as string),
                  ) === null
                )
                  continue;
                liveConnection.skipUpdateOnEstablish = false;
                if (!(liveConnection.response.socket?.destroyed ?? true))
                  liveConnection.update?.();
                await timers.setTimeout(200);
              }
            });
            response.end();
          } catch (error) {
            request.log("ERROR", String(error));
            response.statusCode = 422;
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.end(String(error));
          }
        else {
          const liveConnectionId = request.headers["live-connection"];
          if (typeof liveConnectionId === "string")
            try {
              if (
                request.method !== "GET" ||
                liveConnectionId.match(/^[a-z0-9]{5,}$/) === null
              )
                throw new Error("Invalid ‘Live-Connection’ header.");

              request.liveConnection = [...liveConnections].find(
                (liveConnection) =>
                  liveConnection.request.id === liveConnectionId,
              );
              if (request.liveConnection === undefined) {
                request.log("LIVE CONNECTION CREATE", liveConnectionId);
                request.id = liveConnectionId;
                request.liveConnection = { request, response };
                liveConnections.add(request.liveConnection);
              } else if (
                request.liveConnection.request.URL.href !== request.URL.href
              )
                throw new Error("Unmatched ‘href’ of existing request.");
              else {
                request.log(
                  "LIVE CONNECTION ESTABLISH",
                  request.liveConnection.request.id,
                  request.liveConnection.skipUpdateOnEstablish
                    ? "SKIP UPDATE"
                    : "UPDATE",
                );
                clearTimeout(request.liveConnection.deleteTimeout);
                request.liveConnection.response.liveConnectionEnd?.();
                request.id = request.liveConnection.request.id;
                request.liveConnection.request = request;
                request.liveConnection.response = response;
              }
              response.once("close", () => {
                request.log("LIVE CONNECTION CLOSE");
                if (request.liveConnection!.request === request)
                  request.liveConnection!.deleteTimeout = setTimeout(() => {
                    request.log("LIVE CONNECTION DELETE");
                    liveConnections.delete(request.liveConnection!);
                  }, 30 * 1000).unref();
              });

              response.setHeader(
                "Content-Type",
                "application/json-lines; charset=utf-8",
              );

              const heartbeat = utilities.backgroundJob(
                { interval: 30 * 1000 },
                () => {
                  response.write("\n");
                },
              );
              response.once("close", () => {
                heartbeat.stop();
              });

              const periodicUpdates = utilities.backgroundJob(
                { interval: 5 * 60 * 1000 },
                () => {
                  request.liveConnection!.update?.();
                },
              );
              response.once("close", () => {
                periodicUpdates.stop();
              });

              request.liveConnection.establish = true;

              response.liveConnectionEnd = response.end;
              response.end = ((data?: string): typeof response => {
                request.log("LIVE CONNECTION RESPONSE");
                request.liveConnection!.writableEnded = true;
                if (typeof data === "string")
                  response.write(JSON.stringify(data) + "\n");
                return response;
              }) as (typeof response)["end"];
            } catch (error) {
              request.log("LIVE CONNECTION ERROR", String(error));
              response.statusCode = 400;
              response.setHeader("Content-Type", "text/plain; charset=utf-8");
              response.end(String(error));
            }
          else {
            response.setHeader("Content-Type", "text/html; charset=utf-8");

            response.setCookie = (
              key: string,
              value: string,
              maxAge: number = 150 * 24 * 60 * 60,
            ): typeof response => {
              request.cookies[key] = value;
              response.setHeader("Set-Cookie", [
                ...((response.getHeader("Set-Cookie") as string[]) ?? []),
                `__Host-${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=None`,
              ]);
              return response;
            };

            response.deleteCookie = (key: string): typeof response => {
              delete request.cookies[key];
              response.setHeader("Set-Cookie", [
                ...((response.getHeader("Set-Cookie") as string[]) ?? []),
                `__Host-${encodeURIComponent(key)}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=None`,
              ]);
              return response;
            };

            response.redirect = (
              destination: string = "",
              type: "see-other" | "temporary" | "permanent" = "see-other",
            ): typeof response => {
              response.statusCode = {
                "see-other": 303,
                temporary: 307,
                permanent: 308,
              }[type];
              response.setHeader(
                "Location",
                new URL(destination, request.URL).href,
              );
              response.end();
              return response;
            };
          }

          if (!response.writableEnded)
            do {
              let liveConnectionUpdate;
              if (request.liveConnection !== undefined) {
                if (!request.liveConnection.establish)
                  request.log("LIVE CONNECTION REQUEST");
                request.liveConnection.writableEnded = false;
                liveConnectionUpdate = new Promise<void>((resolve) => {
                  request.liveConnection!.update = resolve;
                });
              }

              request.state = {};
              delete request.error;
              for (const route of routes) {
                if ((request.error !== undefined) !== (route.error ?? false))
                  continue;

                if (
                  (typeof route.method === "string" &&
                    request.method !== route.method) ||
                  (route.method instanceof RegExp &&
                    request.method!.match(route.method) === null)
                )
                  continue;

                if (
                  typeof route.pathname === "string" &&
                  request.URL.pathname !== route.pathname
                )
                  continue;
                else if (route.pathname instanceof RegExp) {
                  const match = request.URL.pathname.match(route.pathname);
                  if (match === null) continue;
                  request.pathname = match.groups ?? {};
                } else request.pathname = {};

                try {
                  await route.handler(request, response);
                } catch (error) {
                  request.log(
                    "ERROR",
                    String(error),
                    (error as Error)?.stack ?? "",
                  );
                  request.error = error;
                }

                if ((request.liveConnection ?? response).writableEnded) break;
              }

              if (!(request.liveConnection ?? response).writableEnded) {
                request.log(
                  "ERROR",
                  "The application didn’t finish handling this request.",
                );
                if (!response.headersSent) {
                  response.statusCode = 500;
                  response.setHeader(
                    "Content-Type",
                    "text/plain; charset=utf-8",
                  );
                }
                response.end(
                  "The application didn’t finish handling this request.",
                );
              }

              if (request.liveConnection !== undefined) {
                request.liveConnection.establish = false;
                request.liveConnection.skipUpdateOnEstablish = true;
                await liveConnectionUpdate;
              }
            } while (request.liveConnection !== undefined);

          if (
            request.method === "GET" &&
            response.statusCode === 200 &&
            response.getHeader("Content-Type") === "text/html; charset=utf-8"
          ) {
            request.log("LIVE CONNECTION PREPARE");
            const liveConnection = {
              request,
              response,
              skipUpdateOnEstablish: true,
              deleteTimeout: setTimeout(() => {
                request.log("LIVE CONNECTION DELETE");
                liveConnections.delete(liveConnection);
              }, 30 * 1000).unref(),
            };
            liveConnections.add(liveConnection);
          }
        }
      }

      request.log(
        "RESPONSE",
        String(response.statusCode),
        String(response.getHeader("Location") ?? ""),
      );
    }) as (
      request: http.IncomingMessage,
      response: http.ServerResponse,
    ) => Promise<void>)
    .listen(port, "localhost", () => {
      log("START");
    });
  process.once("gracefulTermination", () => {
    httpServer.close();
    for (const liveConnection of liveConnections)
      liveConnection.response.liveConnectionEnd?.();
  });
  process.once("beforeExit", () => {
    log("STOP");
  });

  return routes;

  function log(...messageParts: string[]): void {
    utilities.log(String(port), ...messageParts);
  }
}
