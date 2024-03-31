# Radically Straightforward · Build

**🏗️ Build static assets**

## Installation

```console
$ npm install --save-dev @radically-straightforward/build
```

## Usage

Author HTML, CSS, and browser JavaScript using [tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) with [`@radically-straightforward/html`](https://github.com/radically-straightforward/radically-straightforward/tree/main/html), [`@radically-straightforward/css`](https://github.com/radically-straightforward/radically-straightforward/tree/main/css), and [`@radically-straightforward/javascript`](https://github.com/radically-straightforward/radically-straightforward/tree/main/javascript), for example:

**`source/index.mts`**

```typescript
import fs from "node:fs/promises";
import childProcess from "node:child_process";
import server from "@radically-straightforward/server";
import html from "@radically-straightforward/html";
import css from "@radically-straightforward/css";
import javascript from "@radically-straightforward/javascript";
import * as caddy from "@radically-straightforward/caddy";

const application = server();

const staticPaths = JSON.parse(
  await fs.readFile(new URL("./static.json", import.meta.url), "utf-8"),
);

css`
  /* Global CSS, including ‘@font-face’s, typography, ‘.classes’, and so forth. */

  @import "@radically-straightforward/css/static/index.css";

  body {
    background-color: blue;
  }
`;

javascript`
  /* Global JavaScript, including library initialization, global functions, and so forth. */

  import * as javascript from "@radically-straightforward/javascript/static/index.mjs";

  console.log(javascript);
`;

application.push({
  method: "GET",
  pathname: "/",
  handler: (request, response) => {
    response.end(html`
      <!doctype html>
      <html>
        <head>
          <link rel="stylesheet" href="/${staticPaths["index.css"]}" />
          <script src="/${staticPaths["index.mjs"]}"></script>
        </head>
        <body>
          <h1
            css="${css`
              background-color: green;
            `}"
            javascript="${javascript`
              console.log("Hello World");
            `}"
          >
            @radically-straightforward/build
          </h1>
        </body>
      </html>
    `);
  },
});

const caddyServer = childProcess.spawn(
  "./node_modules/.bin/caddy",
  ["run", "--adapter", "caddyfile", "--config", "-"],
  { stdio: [undefined, "inherit", "inherit"] },
);
caddyServer.stdin.end(caddy.application());
```

Use [`@radically-straightforward/tsconfig`](https://github.com/radically-straightforward/radically-straightforward/tree/main/tsconfig) and compile with TypeScript, which generates JavaScript files in the `build/` directory.

> **Note:** You may use other build processes, as long as they generate files at `build/**/*.mjs`.

Call `@radically-straightforward/build`:

> **Note:** `@radically-straightforward/build` overwrites the files at `build/**/*.mjs`.

```console
$ npx build
```

> **Parameters**
>
> - **`--file-to-copy-with-hash`:** [Globs](https://www.npmjs.com/package/globby) of files to be copied into `build/static/`, for example, images, videos, and audios. The file names are appended with a hash of their contents to generate immutable names, for example, `image.jpg` may turn into `image--JF98DJ2LL.jpg`. Consult `build/static.json` for a mapping between the names. The `--file-to-copy-with-hash` parameter may be provided multiple times for multiple globs.
> - **`--file-to-copy-without-hash`:** The same as `--file-to-copy-with-hash`, but the names of the files are preserved. This is useful for `favicon.ico` and other files which must have particular names.

`@radically-straightforward/build` does the following:

- Overwrites the files at `build/**/*.mjs` (and their corresponding source maps) to extract the tagged templates with CSS and browser JavaScript.

- Uses [esbuild](https://esbuild.github.io/) to create a bundle of CSS and browser JavaScript. The result can be found in the `build/static/` directory. The file names contain hashes of their contents to make them immutable, and you may consult `build/static.json` for a mapping between the names—the entrypoint of the CSS is at `index.css` and the entrypoint of the browser JavaScript is at `index.mjs`.

  > **Note:** The bundling process includes transpiling features such as [CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting), including CSS prefixes, minifying, and so forth.

  > **Note:** See [`@radically-straightforward/javascript`](https://github.com/radically-straightforward/radically-straightforward/tree/main/javascript) for library support to use the extracted browser JavaScript.

- Copies the files specified with `--file-to-copy-with-hash` and `--file-to-copy-without-hash`.

### Interpolation

In CSS, interpolation is resolved at build time, which means that expressions must be self-contained and not refer to variables in scope.

For example, the following works:

```javascript
css`
  ${["red", "green", "blue"].map(
    (color) => css`
      .text--${color} {
        color: ${color};
      }
    `,
  )}
`;
```

But the following does **not** work, because `colors` can’t be resolved at build time:

```javascript
const colors = ["red", "green", "blue"];
css`
  ${colors.map(
    (color) => css`
      .text--${color} {
        color: ${color};
      }
    `,
  )}
`;
```

---

In some situations you may need to control the CSS at run time, depending on user data. There are two solutions for this, in order of preference:

1. Apply entire snippets of CSS conditionally, for example:

   ```javascript
   html`
     <div
       css="${userIsSignedIn
         ? css`
             background-color: green;
           `
         : css`
             background-color: red;
           `}"
     ></div>
   `;
   ```

2. When that isn’t viable either, use CSS variables in `style="___"`, for example:

   ```javascript
   html`
     <div
       style="--background-color: ${userIsSignedIn ? "green" : "red"};"
       css="${css`
         background-color: var(--background-color);
       `}"
     ></div>
   `;
   ```

---

In browser JavaScript, interpolation is resolved at run time, and the values are transmitted from the server to the browser as JSON.

For example, the following works:

```javascript
html`
  <div
    javascript="${javascript`
      console.log(${["Hello", 2]});
    `}"
  ></div>
`;
```

But the following does **not** work, because global browser JavaScript does not allow for interpolation:

```javascript
javascript`
  console.log(${["Hello", 2]});
`;
```

## Related Work

- https://vanilla-extract.style
- https://xstyled.dev/
- https://linaria.dev/
- https://www.npmjs.com/package/csjs
- https://www.npmjs.com/package/radium

---

- https://github.com/CraigCav/css-zero
- https://github.com/callstack/linaria/tree/master/packages/babel
- https://github.com/sgtpep/csstag
