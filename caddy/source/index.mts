import path from "node:path";

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
 * A Caddyfile template for an application.
 *
 * **[Global Options](https://caddyserver.com/docs/caddyfile/options)**
 *
 * - Turn off administrative interface.
 *
 * - Set an `email` to the system administrator, which is used for contacting about certificates. If an `email` isn’t provided, then the server is run in development mode with local self-signed certificates.
 *
 * **`(common)` [snippet](https://caddyserver.com/docs/caddyfile/concepts#snippets)**
 *
 * Enables compression for better performance and sets the following headers:
 *
 * - `Strict-Transport-Security`: Tells the browser that moving forward it should only attempt to load this origin with HTTPS (not HTTP). The `hstsPreload` parameter controls whether to set the [`preload` directive](https://hstspreload.org/)—by default it’s `false`, but it’s recommended that you opt into preloading by setting `hstsPreload: true`.
 *
 * - `Cache-Control`: Turns off HTTP caching. This is the best setting for the dynamic parts of the application: in the best case the cache may be stale, and in the worst case the cache may include private information that could leak even after signing out. For static files, we recommend that you overwrite this header to enable caching, for example, `header Cache-Control "public, max-age=31536000, immutable"`.
 *
 * - `X-Content-Type-Options`: Turns off `Content-Type` sniffing, because: 1. The application may break if content sniffing goes wrong; and 2. Content sniffing needs access to the response body but the response body may take long to arrive in streaming responses. Make sure to set the `Content-Type` header appropriately.
 *
 * - `X-XSS-Protection`: Disables XSS filtering because, ironically, [XSS filtering may make the application vulnerable](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection#vulnerabilities_caused_by_xss_filtering).
 *
 * - `Permissions-Policy`: Opts out of [FLoC](https://web.dev/articles/floc).
 *
 * - `Origin-Agent-Cluster`: Tells the browser to try and isolate the process running the application.
 *
 * - `Content-Security-Policy`: Allows the application to retrieve content only from the same origin. Inline styles are allowed. Frames and objects are disabled. Forms may only be submitted to the same origin. If you need to serve images from third-party websites (for example, as part of content generated by users), setup a content proxy (it also solves the potential issue of [mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content)).
 *
 * - `Cross-Origin-*-Policy`: Allow only the same origin to load content from the application. This is the converse of the `Content-Security-Policy` header. For files that you wish to allow embedding in other origins, set `header Cross-Origin-Resource-Policy cross-origin`.
 *
 * - `X-Frame-Options`: Disallows the application from being embedded in a frame.
 *
 * - `X-Permitted-Cross-Domain-Policies`: Disallows the application from being embedded in a PDF, a Flash document, and so forth.
 *
 * - `X-DNS-Prefetch-Control`: Disables DNS prefetching, because DNS prefetching could leak information about the application to potentially untrusted DNS servers.
 *
 * - `Referrer-Policy`: Tells the browser to not send the `Referer` request header. This makes the application more secure because external links don’t leak information about the URL that the user was on.
 *
 * **References**
 *
 * - <https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP> and other articles under **HTTP security**.
 * - <https://owasp.org/www-project-secure-headers/>
 * - <https://helmetjs.github.io/>
 */
export function application({
  hostname = "localhost",
  staticFilesPaths = ["static/"],
  userGeneratedFilesPaths = ["data/"],
  reverseProxyPorts = ["8000"],
  email = undefined,
  hstsPreload = false,
}: {
  hostname?: string;
  staticFilesPaths?: string[];
  userGeneratedFilesPaths?: string[];
  reverseProxyPorts?: string[];
  email?: string;
  hstsPreload?: boolean;
} = {}): Caddyfile {
  return caddyfile`
    {
      admin off
      ${email !== undefined ? `email ${email}` : `local_certs`}
    }

    ${hostname} {
      encode zstd gzip

      header Strict-Transport-Security "max-age=31536000; includeSubDomains${
        hstsPreload ? `; preload` : ``
      }"
      header Cache-Control no-store
      header X-Content-Type-Options nosniff
      header X-XSS-Protection 0
      header Permissions-Policy "interest-cohort=()"
      header Origin-Agent-Cluster "?1"
      header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'"
      header Cross-Origin-Resource-Policy same-origin
      header Cross-Origin-Embedder-Policy require-corp
      header Cross-Origin-Opener-Policy same-origin
      header X-Frame-Options DENY
      header X-Permitted-Cross-Domain-Policies none
      header X-DNS-Prefetch-Control off
      header Referrer-Policy no-referrer

      route {
        ${staticFilesPaths
          .map(
            (staticFilesPath) => caddyfile`
              route {
                root * "${path.resolve(staticFilesPath)}"
                @file_exists file
                route @file_exists {
                  header Cache-Control "public, max-age=31536000, immutable"
                  file_server
                }
              }
            `,
          )
          .join("\n\n")}

        ${userGeneratedFilesPaths
          .map(
            (userGeneratedFilesPath) => caddyfile`
              route {
                root * "${path.resolve(userGeneratedFilesPath)}"
                @file_exists file
                route @file_exists {
                  header Cache-Control "private, max-age=31536000, immutable"
                  @safe path *.webp *.webm *.png *.jpg *.jpeg *.gif *.mp3 *.mp4 *.m4v *.ogg *.mov *.mpeg *.avi *.pdf *.txt
                  header @safe Cross-Origin-Resource-Policy cross-origin
                  header not @safe Content-Disposition attachment
                  file_server
                }
              }
            `,
          )
          .join("\n\n")}

        reverse_proxy ${reverseProxyPorts
          .map((applicationPort) => `http://localhost:${applicationPort}`)
          .join(" ")}
      }
    }
  `;
}
