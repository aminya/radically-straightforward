/**
 * A type alias to make your type annotations more specific.
 */
export type Caddyfile = string;

/**
 * A [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) for [Caddyfile](https://caddyserver.com/docs/quick-starts/caddyfile).
 */
export default function caddyfile(
  templateStrings: TemplateStringsArray,
  ...substitutions: Caddyfile[]
): Caddyfile {
  let output = "";
  for (const index of substitutions.keys()) {
    const templateString = templateStrings[index];
    output += templateString;
    const substitution = substitutions[index];
    output += substitution;
  }
  output += templateStrings.at(-1);
  return output;
}

/**
 * A Caddyfile header that defines:
 *
 * - [Global options](https://caddyserver.com/docs/caddyfile/options) that:
 *
 *   - Turn off administrative interface.
 *
 *   - Set an `email` to the system administrator, which is used for contacting about certificates. If an `email` isn’t provided, then the server is run in development mode with local self-signed certificates.
 *
 * - A [snippet](https://caddyserver.com/docs/caddyfile/concepts#snippets) named `(common)` including:
 *
 *   - The `Cache-Control no-store` header, which turns off HTTP caching. This is the best setting for dynamic parts of the application: in the best case the cache may be stale, and in the worst case the cache may include private information that could outlive signing out. For static files, we recommend that you overwrite this header to enable caching, for example, `header Cache-Control "public, max-age=31536000, immutable"`.
 *
 *   - The `Content-Security-Policy` header, which allows the application to retrieve content from the same origin only. Inline styles are allowed. Objects and frames are disabled. If you need to serve images from third-party websites (for example, which may have been included as part of content generated by users), setup a content proxy (it also solves the potential issue of [mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content)).
 *
 *   - The `Cross-Origin` headers, which allow only the same origin to load content from the application. This is the converse of the `Content-Security-Policy` header. For files that you wish to allow embedding in other origins, set the `header Cross-Origin-Resource-Policy cross-origin` header.
 *
 *   - The `Referrer-Policy no-referrer` header, which tells the browser to not send the `Referer` request header. This makes the application more secure because external links don’t leak information about the URL that the user was on.
 *
 *   - The `Strict-Transport-Security` header, which tells the browser that moving forward it should only attempt to load this origin with HTTPS (not HTTP). The `hstsPreload` parameter controls whether to set the [`preload` option](https://hstspreload.org/)—by default it’s `false`, but it’s recommended that you opt into preloading by setting `hstsPreload: true`.
 *
 *   - The `Origin-Agent-Cluster` header, which tells the browser to try and isolate the process running the application.
 *
 *   - The `X-Content-Type-Options` header, which turns off `Content-Type` sniffing, because the application may break if content sniffing goes wrong, and content sniffing needs access to the response body but the response may be unavailable in streaming responses. Make sure to set the `Content-Type` header appropriately.
 *
 *   - The `X-DNS-Prefetch-Control` header, which disables DNS prefetching, because DNS prefetching could leak information about the application to potentially untrusted DNS servers.
 *
 *   - The `X-Frame-Options` header, which disallows the application from being embedded in an iframe by another page.
 *
 *   - The `X-Permitted-Cross-Domain-Policies` header, which disallows the application from being embedded in a PDF, a Flash document, and so forth.
 *
 *   - Removing the `Server` and `X-Powered-By`, which identify what server the application is running.
 *
 *   - The `Permissions-Policy` header, which opts the application out of [FLoC](https://web.dev/articles/floc).
 *
 *   - Enabling compression for better performance.
 *
 * An example of using the (`common`) snippet, including a server that tries to serve a static file if it exists, and failing that, reverse proxies to the dynamic part of the application:
 *
 * ```caddyfile
 * ${caddy.header()}
 *
 * https://localhost {
 *   import common
 *
 *   route {
 *     root * ./static/
 *     @file_exists file
 *     route @file_exists {
 *       header Cache-Control "public, max-age=31536000, immutable"
 *       file_server
 *     }
 *   }
 *
 *   reverse_proxy http://localhost:8000 http://localhost:8001 {
 *     lb_retries 1
 *   }
 *
 *   handle_errors {
 *     import common
 *   }
 * }
 *
 * ${caddy.httpRedirect("localhost")}
 * ```
 */
export function header({
  email = undefined,
  hstsPreload = false,
}: {
  email?: string;
  hstsPreload?: boolean;
} = {}): Caddyfile {
  return caddyfile`
    {
      admin off
      ${email !== undefined ? `email ${email}` : `local_certs`}
    }

    (common) {
      header Cache-Control no-store
      header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; form-action 'self'; frame-ancestors 'none'"
      header Cross-Origin-Embedder-Policy require-corp
      header Cross-Origin-Opener-Policy same-origin
      header Cross-Origin-Resource-Policy same-origin
      header Referrer-Policy no-referrer
      header Strict-Transport-Security "max-age=31536000; includeSubDomains${
        hstsPreload ? `; preload` : ``
      }"
      header X-Content-Type-Options nosniff
      header Origin-Agent-Cluster "?1"
      header X-DNS-Prefetch-Control off
      header X-Frame-Options DENY
      header X-Permitted-Cross-Domain-Policies none
      header -Server
      header -X-Powered-By
      header X-XSS-Protection 0
      header Permissions-Policy "interest-cohort=()"
      encode zstd gzip
    }
  `;
}

/**
 * Set an HTTP redirect. Useful, for example, for redirecting alternative hostnames to the main hostname of the application.
 */
export function redirect(
  fromHostname: string,
  toHostname: string,
  type: "temporary" | "permanent" = "temporary",
): Caddyfile {
  return caddyfile`
    https://${fromHostname} {
      import common
      redir https://${toHostname}{uri} ${
        { temporary: "307", permanent: "308" }[type]
      }
      handle_errors {
        import common
      }
    }
  `;
}

/**
 * Redirect HTTP → HTTPS.
 *
 * > **Note:** Caddy can set this up automatically, but it doesn’t include the security headers in `(common)`.
 */
export function httpRedirect(hostnames: string | string[]): Caddyfile {
  if (typeof hostnames === "string") hostnames = [hostnames];
  return caddyfile`
    ${hostnames
      .map(
        (hostname) => caddyfile`
          http://${hostname} {
            import common
            redir https://${hostname}{uri} 308
            handle_errors {
              import common
            }
          }
        `,
      )
      .join("\n\n")}
  `;
}
