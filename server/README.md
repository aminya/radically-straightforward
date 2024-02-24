# Radically Straightforward · Server

**🦾 HTTP server in Node.js**

## Installation

```console
$ npm install @radically-straightforward/server
```

## Usage

TODO

## Requirements

- Parse request:
  - Body.
    - Concerns
      - Size limits (HTTP status 413)
    - `application/x-www-form-urlencoded`
      - `URLSearchParams`
      - <https://github.com/expressjs/body-parser>.
    - `multipart/form-data`
      - <https://github.com/mscdex/busboy>.
        - <https://github.com/expressjs/multer>.
        - <https://github.com/richardgirges/express-fileupload>.
      - <https://github.com/node-formidable/formidable>.
        - Does too much (plugins, and so forth).
      - <https://github.com/pillarjs/multiparty>.
        - They recommend using `busboy`.
        - <https://github.com/expressjs/connect-multiparty>.
      - <https://github.com/hapijs/pez>.
        - No documentation.
    - Edge cases
      - Different charsets?
      - `Content-Encoding` (for example, compression)
- Response helpers:
  - Use data returned by handler to control response.
  - Cookies.
    - `encodeURIComponent`
  - Set headers.
  - Redirect.
  - Body.
    - `Content-Type`
      - `node:util`’s `MIMEType`
    - `Content-Length`?
  - Stream.
  - Locals to build response over multiple handlers.
- Route based on several aspects of request.
- Allow multiple handlers to handle the same request.
  - Have functions that run after the response.
- Async handlers.
- Error handlers.
- Terminate responses gracefully.
  - Error in case response isn’t terminated.
- Logging:
  - `X-Forwarded-Host`
- Live updates.
- Missing stuff from:
  - Koa
  - Express
- Content proxy (we already have one in Courselore using Got—try to develop one using `fetch`)
  - Link in documentation for `@radically-straightforward/caddy`’s `header()`.
- Future:
  - Pass `pathname` parameters through `decodeURIComponent`?

## Features

- Always listen on `localhost`, because you should be using Caddy as reverse proxy.
- Graceful termination.
- Parse pathname parameters, query parameters, headers, and request body.
- Trusts reverse proxy, because it’s meant to be used with Caddy.
- Doesn’t serve static files, because it’s meant to be used with Caddy.
- Handlers infrastructure:
  - Register functions to run after.

## Related Work

- <https://fastify.dev/>
- <https://koajs.com/>
- <https://hono.dev/>
- <https://routup.net/>
- <https://itty.dev/itty-router>
- <https://github.com/lukeed/worktop>
