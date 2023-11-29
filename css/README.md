<!--

https://html-first.com/

0.9.6 → 0.10.0

`gray--blue` → `slate`
`gray--cool` → `gray`
`gray--medium` → `zinc`
`gray--true` → `neutral`
`gray--warm` → `stone`

`900` → `950`

---

```
https://open-props.style


If you wish to overwrite styles set by the parent, use the `&& { ... }` pattern
<div
  css="${css`
    p {
      background-color: green;
    }
  `}"
>
  <p>Hello</p>
  <p
    css="${css`
      && {
        background-color: blue;
      }
    `}"
  >
    Hello
  </p>
  <p>Hello</p>
</div>
```








## Fast Non-Cryptographic Hashes

- Algorithms
  - **xxHash:** Self-proclaimed the fastest. (That’s my option)
  - djb2: Beautifully simple.
  - Murmur: Used by most other CSS-in-JS tools.
- Uses by other related tools:
  - esbuild: xxHash & Boost’s hash_combine (not really sure which does which, but I feel xxHash is doing the file hashing).
  - styled-components: djb2
    - Progressive, which means the same hash is updated across elements that need to be hashed
      - Good: Remarkably simple.
      - Bad: The stability of the hashes depends upon the other of the hashed objects, and one removal in the middle affects all the subsequent hashes.
  - Emotion: murmur2
  - vanilla-extract: @emotion/hash & MD5
  - Linaria: murmur2
  - Compiled: murmur2
  - All of these implementations are only for strings, not for arbitrary binary data, which we need to do cache busting of images, for example.

## xxHash Implementations for Node.js

- All of them support `Buffer`s (binary data and/or strings) & `Stream`s.
- Options below in order of popularity.

---

- xxhashjs
  - Pure JavaScript (port).
  - Hasn’t been updated recently.
- xxhash-wasm
  - Wasm
    - Maybe compiled from the canonical implementation, maybe hand-written?
  - Orders of magnitude faster than xxhashjs
  - Updated recently
    -xxhash
  - Node.js native module (old API) based on the canonical implementation.
  - Hasn’t been updated recently.
  - Annoying interface that requires a seed (which could be zero).
- **xxhash-addon** (That’s my option)
  - Node.js native module (N-API) based on the canonical implementation.
  - Updated recently.
  - The only one to provide XXH3

## `` css`...` `` & `` javascript`...` ``

- What I think of as interpolation many of these libraries call “dynamic” properties/styles/etc.

---

- Astroturf
  - Allows two types of interpolation:
    - Values, using CSS variables.
    - Blocks, using extra classes.
      - Doesn’t seem to support nesting, because that requires you to parse the CSS & extract the classes nested inside.
- vanilla-extract
  - Doesn’t seem to allow for interpolation.
- Linaria
  - Only interpolation of values, using CSS variables.
- Compiled
  - No interpolation at all

---

- Conclusion:
  - `` css`...` `` is evaluated statically, and doesn’t have access to local variables.
    - That’s because of nesting, which would require you to parse the CSS & extract the classes nested inside.
    - But that’s alright, because CSS is static most of the time. Otherwise, you can use CSS variables, conditional addition of whole blocks of CSS, and so forth.
  - `` javascript`...` `` allows for interpolation by forwarding the arguments.

## JavaScript Compilation

- Babel Macros (https://github.com/kentcdodds/babel-plugin-macros)
  - Useful for `create-react-app` and things that don’t allow you to change configuration easily.
  - Macros have to be CommonJS
    - A Babel visitor must be synchronous and the visitor needs to `require()` the macro definition, but `import()` is async.
  - The interface is more limited (for example, I think it doesn’t give you easy access to the output file name).
  - The emotion documentation, for example, also recommends a Babel plugin approach instead of a macro if you can, because it allows for extra optimizations.
- **Babel Plugin** (That’s my option)
  - More powerful & easier to conceptualize.
- TypeScript transformation
  - The `tsc` compiler doesn’t yet let you run your own transforms.
  - And what if your project isn’t using TypeScript?
- recast (https://github.com/benjamn/recast & https://github.com/benjamn/ast-types)
  - It’s more for codemods, where a human is involved in looking at the output.
  - Doesn’t offer a lot more on top of Babel. It’s purpose is, for example, to preserve whitespace in the code, which we don’t care about.
- https://github.com/facebook/jscodeshift
  - codemod seems abandoned
  - Based on recast
  - Seems to only be useful if you’re already in the context of codemods
- https://github.com/acornjs/acorn
  - More popular than Babel, but requires other auxiliary tools
  - https://github.com/estools/escodegen
- esbuild doesn’t allow you to manipulate the AST
- https://github.com/swc-project/swc
  - Plugin is written in Rust.

---

- Useful references:
  - https://astexplorer.net
  - https://babeljs.io/docs/en/babel-types
  - https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md

---

- Implementation references:
  - https://github.com/CraigCav/css-zero
  - https://github.com/callstack/linaria/tree/master/packages/babel
  - https://github.com/sgtpep/csstag



Pull CSS from source code at build time:


```
import fs from "node:fs/promises";
import recast from "recast";

const input = await fs.readFile("input.mjs", "utf-8");
const ast = recast.parse(input, {
  sourceFileName: "input.mjs",
});
// console.log(JSON.stringify(ast, undefined, 2));

let css = "";

recast.visit(ast, {
  visitTaggedTemplateExpression(path) {
    if (path.node.tag.name !== "css" || path.node.quasi.quasis.length !== 1)
      return this.traverse(path);

    css += path.node.quasi.quasis[0].value.cooked;

    path.replace(recast.types.builders.stringLiteral("banana"));

    return false;
  },
});

const output = recast.print(ast, { sourceMapName: "output.mjs" });
console.log("output.mjs");
console.log();
console.log(output.code);
console.log();
// console.log(output.map);

console.log("output.css");
console.log();
console.log(css);
console.log();
```

```
// npm install @babel/parser @babel/traverse @babel/types @babel/generator

import fs from "node:fs/promises";
import babelParser from "@babel/parser";
import babelTraverse from "@babel/traverse";
import babelTypes from "@babel/types";
import babelGenerator from "@babel/generator";

const input = await fs.readFile("input.mjs", "utf-8");
const ast = babelParser.parse(input);
// console.log(JSON.stringify(ast, undefined, 2));
babelTraverse.default(ast, {
  TaggedTemplateExpression(path) {
    if (path.node.tag.name === "css")
      path.replaceWith(babelTypes.stringLiteral("banana"));
  },
});
const output = babelGenerator.default(ast).code;
console.log(output);
```










- Update to Tailwind 3
- Use explicit names like `large` instead of `lg`
- Normalize spaces with .replace(/\s/+, " "). This should reduce the number of redundant classes.
- Document: Don’t use #ids, because of specificity (use `key=""`s instead, for compatibility with @leafac/javascript)

Don’t interpolate with user data, or you’ll blow up the cache


<h1 align="center">@leafac/css</h1>
<h3 align="center">Radically Straightforward CSS</h3>
<p align="center">
<a href="https://github.com/leafac/css"><img src="https://img.shields.io/badge/Source---" alt="Source"></a>
<a href="https://www.npmjs.com/package/@leafac/css"><img alt="Package" src="https://badge.fury.io/js/%40leafac%2Fcss.svg"></a>
<a href="https://github.com/leafac/css/actions"><img src="https://github.com/leafac/css/workflows/.github/workflows/main.yml/badge.svg" alt="Continuous Integration"></a>
</p>

### Support

- <https://patreon.com/leafac>
- <https://paypal.me/LeandroFacchinetti>

### Installation

```console
$ npm install @leafac/css
```

### Example

```typescript
import html from "@leafac/html";
import { css, extractInlineStyles } from ".";

console.log(
  extractInlineStyles(html`
    <!DOCTYPE html>
    <html lang="en">
      <head></head>
      <body>
        <p
          style="${css`
            background-color: var(--color--red--500);
            &:hover {
              background-color: var(--color--red--300);
            }

            @media (max-width: 599px) {
              margin: 1rem;
            }
          `}"
        >
          Leandro Facchinetti
        </p>
      </body>
    </html>
  `)
);
```

Produces:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <style>
      /* ... A PREAMBLE WITH A CSS RESET, A DESIGN SYSTEM, AND SO FORTH ... */

      /* INLINE STYLES */

      .style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw {
        background-color: var(--color--red--500);
      }

      .style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw:hover {
        background-color: var(--color--red--300);
      }

      @media (max-width: 599px) {
        .style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw.style--1s69iw {
          margin: 1rem;
        }
      }
    </style>
  </head>
  <body>
    <p class="style--1s69iw">Leandro Facchinetti</p>
  </body>
</html>
```

<details>
<summary>What’s up with the Repeated Selectors?</summary>

It’s a hack to give the selector a specificity high enough that it won’t be overwritten by most other styles.

</details>

<details>
<summary>What’s [@leafac/html](https://npm.im/@leafac/html)?</summary>

That’s my other package for Radically Straightforward HTML, which is just HTML templates embedded in JavaScript using [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates).

</details>

### What’s in the Box? (Why I Love Tailwind Css; Why I Have Never Actually Used It; And How I’m Proposing to Replace It with 10 Lines of Code.)

#### A Radically Straightforward Approach to CSS

In the beginning, styles lived inline in the HTML. That was good because it was the simplest thing that could work, but it had its limitations: design inconsistencies, verbosity, and so forth.

We solved this by pulling styles into a stylesheet and connecting them to the HTML via selectors, classes, ids, and so forth. That was good because it led to more consistent designs, relatively less code, and some reusable components, for example, those in the most popular components library, [Bootstrap](https://getbootstrap.com). But it had its limitations: the HTML and its corresponding styles were far away, which can make things more difficult to understand and modify; and you often had to spend time being creative to come up with class names that didn’t describe much of anything, and existed only to connect the HTML to its corresponding styles.

People have come to realize that both approaches have their place. We start with a global stylesheet including things like fonts, colors, sizes, and so forth; and we complete the job with inline styles. We avoid extracting things into reusable components until they really do need to be reused in other places.

This is the driving principle behind the popularity of tools like [Tailwind CSS](https://tailwindcss.com). Unlike Bootstrap, Tailwind isn’t a collection of components—it’s a framework at a lower level. It’s closer to an **approach** for how to reason about styles. I **love** how straightforward, productive, and scalable this approach feels. And I’m not alone. But Tailwind has its limitations.

##### Why Not Use Tailwind CSS?

**Because it’s a new language to learn.** The good-old `width: 8rem` turns into `m-32`; and `text-align: center` turns into `text-center`; and so forth. While it’s true that you can become proficient in this new language relatively quickly, you still have to keep translating things in your head the entire time you’re using Tailwind. Every time you read CSS documentation, or a tutorial showing how to do something, you have to translate.

**Because the Tailwind CSS build system is weird.** For the longest time Tailwind worked by producing every single utility class you could possibly want to use; then pruning everything you didn’t end up using, which is most things. This feels backwards, and it isn’t super-fast either. In the most recent releases Tailwind introduced a just-in-time compiler that alleviates some of these concerns. Both the pruning and the just-in-time compiler work by inspecting your HTML to detect which utility classes you used.

##### But What to Use Instead of Tailwind? Inline Styles with Modest Superpowers

The Tailwind approach is [similar in spirit to inline styles](https://tailwindcss.com/docs/utility-first#why-not-just-use-inline-styles), but it improves upon inline styles in the following ways:

**Designing with constraints:** Using a design system is an **awesome** idea and improved my game as a developer venturing into design more than anything else I’ve ever tried. But we could have the design system as any kind of sets of variables, most notably [CSS custom properties (variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties), but [Sass](https://sass-lang.com) variables or anything else would also work.

**Responsive design; hover, focus, and other states:** That’s when the **modest superpowers** of inline styles come in. While it’s true that inline styles can’t have media queries or `:hover`, `:focus`, and so forth, what if instead of introducing a new language of class names like `md:...` and `hover:...`, we just preprocessed the inline styles to give them these abilities? It’s easy with nesting:

```html
<body>
  <p
    style="
      background-color: red;

      @media (max-width: 599px) {
        margin: 1rem;
      }

      &:hover {
        background-color: blue;
      }
    "
  >
    Leandro Facchinetti
  </p>
</body>
```

Becomes:

```html
<head>
  <style>
    .style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2 {
      background-color: red;
    }

    @media (max-width: 599px) {
      .style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2 {
        margin: 1rem;
      }
    }

    .style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2.style--zvyll2:hover {
      background-color: blue;
    }
  </style>
</head>
<body>
  <p class="style--zvyll2">Leandro Facchinetti</p>
</body>
```

**BOOM:** The first time you read this you already understood it. Nesting is super-natural at this point to most people writing CSS. It’s supported by all pre-processors and it’s on track to become a standard in CSS.

@leafac/css is a preprocessor that does exactly this. But more importantly, @leafac/css is an architectural statement that this is how we should be writing our styles.

<!-- Htmx
style -> data-style ??? -->

<!-- * My approach to css & ondomcontentloaded is just object oriented programming -->

<!--



- [ ] Reason why my css strategy is good: no !importantts to overwrite with js
    - [ ] Why I like Tailwind: Principle of locality; avoid premature optimization
    - [ ] What I don’t like: Learning curve; weird build system
    - [ ] Oh, but my approach requires you to process the HTML; well Tailwind uses Purge, which has teh same requirement…
    - [ ] You’re only loading the css you need for that page
    - [ ] https://youtu.be/J_7_mnFSLDg?t=1695 DUDE’S COPYING THE HTML TO CHANGE INLINE STYLES!! OH NOES!



- [ ] It reflects the fullstack nature of the developer
- [ ] Separation of concerns, but feature-wide instead of presentation/behavior/markup
- [ ] References:
    - [ ] https://www.npmjs.com/package/csjs
    - [ ] https://www.npmjs.com/package/radium



    https://vanilla-extract.style
    Type checking & autocomplete. I’m totally stealing that idea! Instead of writing:

color: var(--color--green--200);

You’ll write something like:

color: ${css.color.green[200]};


xxhash

https://xstyled.dev

https://github.com/bryc/code/tree/master/jshash/hashes

https://linaria.dev/
 -->

<!-- What else is there to love about Tailwind? The docs (including the book), and the design system -->

<!-- And sometimes in those situations extracting CSS components isn’t the right level of abstraction, because the component also has opinions on the HTML. React, for example, but we can do it much more simply. -->

<!-- Put a code example right away -->

<!-- <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1"
          /> -->

<!--
trust your eyes

screens: don’t use a set of breakpoints, instead look at the interface, determine when it isn’t working anymore, and add a breakpoint there (also, CSS custom properties don’t work in media queries)

approach:
reset
design system
global styles (for example, font)
components for things like form inputs and buttons
inline styles everywhere else

think about styles and order them in the stylesheet inside-out


- https://tailwindcss.com/docs/utility-first#why-not-just-use-inline-styles

      // TODO: Make this possibly faster by using Rehype instead of JSDOM (though we have to benchmark to be sure…)
      //       https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes
      //         https://www.npmjs.com/package/pseudo-classes
      //       https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements
      //       https://github.com/postcss/postcss
      //       https://github.com/brettstimmerman/mensch
      // https://stackoverflow.com/questions/10963997/css-parser-for-javascript
      // https://github.com/CSSLint/parser-lib
      // https://github.com/NV/CSSOM
      // https://github.com/reworkcss/css
      // https://www.npmjs.com/package/cssparser
      // https://rahulnpadalkar.medium.com/css-parser-in-javascript-578eba0977e5
      // https://github.com/rahulnpadalkar/CSSParser
      // http://glazman.org/JSCSSP/

      // https://github.com/postcss/postcss-scss
      // https://github.com/postcss/postcss-js
      // https://github.com/jonathantneal/precss
      // https://github.com/postcss/postcss-nested (more installations than the one below)
      // https://github.com/jonathantneal/postcss-nesting (closer to the standard and more stars than the one above)

      // https://github.com/jsdom/cssstyle
      // https://github.com/reworkcss/css
      // https://github.com/css/csso
      // https://github.com/csstree/csstree
      // https://github.com/brettstimmerman/mensch



Use @leafac/html with [Prettier](https://prettier.io) (automatic formatting), and the Visual Studio Code extensions [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (Prettier support) and [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html) (syntax highlighting).


### Related Projects


### Prior Art


-->

# Radically Straightforward · CSS

**💄 CSS in [Tagged Templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)**

## Installation

```console
$ npm install @radically-straightforward/css
```

> **Note:** We recommend the following tools:
>
> **[Prettier](https://prettier.io):** A code formatter that supports CSS in tagged templates.
>
> **[Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode):** A [Visual Studio Code](https://code.visualstudio.com/) extension to use Prettier more ergonomically.

## Usage

```typescript
import css, { CSS } from "@radically-straightforward/css";
```

<!-- DOCUMENTATION START: ./source/index.mts -->

### `HTML`

```typescript
export type HTML = string;
```

A type alias to make your type annotations more specific.

### `html()`

```typescript
export default function html(
  templateStrings: TemplateStringsArray,
  ...substitutions: (string | string[])[]
): HTML;
```

A [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) for HTML:

```typescript
html`<p>Leandro Facchinetti</p>`;
```

Sanitizes interpolations to prevent injection attacks:

```typescript
html`<p>${"Leandro Facchinetti"}</p>`;
// => `<p>Leandro Facchinetti</p>`
html`<p>${`<script>alert(1);</script>`}</p>`;
// => `<p>&lt;script&gt;alert(1);&lt;/script&gt;</p>`
```

> **Note:** Sanitization is only part of the defense against injection attacks. Also deploy the following measures:
>
> - Serve your pages with UTF-8 encoding.
> - Have your server send the header `Content-Type: text/html; charset=utf-8`.
> - If you want to be extra sure that the encoding will be picked up by the browser, include a `<meta charset="utf-8" />` meta tag. (But HTML 5 documents must be encoded in UTF-8, so it should be sufficient to declare your document as HTML 5 by starting it with `<!DOCTYPE html>`.)
> - Always use quotes around HTML attributes (for example, `href="https://leafac.com"` instead of `href=https://leafac.com`).
> - See <https://wonko.com/post/html-escaping/>.

> **Note:** This library works by concatenating strings. It doesn’t prettify the output (if you need that you may, for example, call [Prettier](https://prettier.io/) programmatically on the output of `` html`___` ``), and it doesn’t generate any kind of [virtual DOM](https://reactjs.org/docs/faq-internals.html). The virtues of this approach are that this library is conceptually simple and it is one order of magnitude faster than [`ReactDOMServer.renderToStaticMarkup()`](https://react.dev/reference/react-dom/server/renderToStaticMarkup) (performance matters because rendering may be one of the most time-consuming tasks in responding to a request).

Opt out of sanitization with `$${___}` instead of `${___}`:

```typescript
html`<div>$${`<p>Leandro Facchinetti</p>`}</div>`;
// => `<div><p>Leandro Facchinetti</p></div>`
```

> **Note:** Only opt out of sanitization if you are sure that the interpolated string is safe, in particular it must not contain user input, otherwise you’d be open to injection attacks:
>
> ```typescript
> html`<div>$${`<script>alert(1);</script>`}</div>`;
> // => `<div><script>alert(1);</script></div>`
> ```

> **Note:** You must opt out of sanitization when the interpolated string is itself the result of `` html`___` ``, otherwise the escaping would be doubled:
>
> ```typescript
> html`
>   <div>
>     Good (escape once): $${html`<p>${`<script>alert(1);</script>`}</p>`}
>   </div>
> `;
> // =>
> // `
> //   <div>
> //     Good (escape once): <p>&lt;script&gt;alert(1);&lt;/script&gt;</p>
> //   </div>
> // `
>
> html`
>   <div>
>     Bad (double escaping): ${html`<p>${`<script>alert(1);</script>`}</p>`}
>   </div>
> `;
> // =>
> // `
> //   <div>
> //     Bad (double escaping): &lt;p&gt;&amp;lt;script&amp;gt;alert(1);&amp;lt;/script&amp;gt;&lt;/p&gt;
> //   </div>
> // `
> ```

> **Note:** As an edge case, if you need a literal `$` before an interpolation, interpolate the `$` itself:
>
> ```typescript
> html`<p>${"$"}${"Leandro Facchinetti"}</p>`;
> // => `<p>$Leandro Facchinetti</p>`
> ```

Interpolated lists are joined:

```typescript
html`<p>${["Leandro", " ", "Facchinetti"]}</p>`;
// => `<p>Leandro Facchinetti</p>`
```

> **Note:** Interpolated lists are sanitized:
>
> ```typescript
> html`
>   <p>${["Leandro", " ", "<script>alert(1);</script>", " ", "Facchinetti"]}</p>
> `;
> // =>
> // `
> //   <p>Leandro &lt;script&gt;alert(1);&lt;/script&gt; Facchinetti</p>
> // `
> ```
>
> You may opt out of the sanitization of interpolated lists by using `$${___}` instead of `${___}`:
>
> ```typescript
> html`
>   <ul>
>     $${[html`<li>Leandro</li>`, html`<li>Facchinetti</li>`]}
>   </ul>
> `;
> // =>
> // `
> //   <ul>
> //     <li>Leandro</li><li>Facchinetti</li>
> //   </ul>
> // `
> ```

### `sanitize()`

```typescript
export function sanitize(
  text: string,
  replacement: string = sanitize.replacement,
): string;
```

Sanitize text for safe insertion in HTML.

`sanitize()` escapes characters that are meaningful in HTML syntax and replaces invalid XML characters with a string of your choosing—by default, an empty string (`""`). You may provide the `replacement` as a parameter or set a new default by overwriting `sanitize.replacement`. For example, to use the [Unicode replacement character](<https://en.wikipedia.org/wiki/Specials_(Unicode_block)#Replacement_character>):

```typescript
sanitize.replacement = "�";
```

> **Note:** The `` html`___` `` tagged template already calls `sanitize()`, so you must **not** call `sanitize()` yourself or the sanitization would happen twice.

> **Note:** The sanitization to which we refer here is at the character level, not cleaning up certain tags while preserving others. For that, we recommend [`rehype-sanitize`](https://npm.im/rehype-sanitize).

> **Note:** Even this sanitization isn’t enough in certain contexts, for example, HTML attributes without quotes (`<a href=${sanitize(___)}>`) could still lead to XSS attacks.

### `escape()`

```typescript
export function escape(text: string): string;
```

Escape characters that are meaningful in HTML syntax.

What sets this implementation apart from existing ones are the following:

- **Performance.**

  The performance of the `escape()` function matters because it’s used frequently to escape user input when rendering HTML with the `` html`___` `` tagged template.

  The following are some details on how this implementation is made faster:

  - The relatively new string function `.replaceAll()` when used with a string parameter is faster than `.replace()` with a regular expression.

  - Perhaps surprisingly, calling `.replaceAll()` multiple times is faster than using a single regular expression of the kind `/[&<>"']/g`.

  - And even if we were to use a single regular expression, using `switch/case` would have been faster than the lookup tables that most other implementations use.

  - And also if we were to use regular expressions, using the flag `v` incurs on a very small but consistent performance penalty.

  - And also if we were to use regular expressions, `.replace()` is marginally but consistently faster than `.replaceAll()`.

  - Measurements performed in Node.js 21.2.0.

- **Supports modern browsers only.**

  Most other implementations escape characters such as `` ` ``, which could cause problems in Internet Explorer 8 and older.

  Some other implementations avoid transforming `'` into the entity `&apos;`, because that entity isn’t understood by some versions of Internet Explorer.

**References**

- <https://github.com/lodash/lodash/blob/ddfd9b11a0126db2302cb70ec9973b66baec0975/lodash.js#L384-L390>
- <https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/src/he.js#L35-L50>
- <https://github.com/fb55/entities/blob/02a5ced5708fa4a91b9f17a038da24d1c6200f1f/src/escape.ts>
- <https://mathiasbynens.be/notes/ambiguous-ampersands>
- <https://wonko.com/post/html-escaping/>
- <https://stackoverflow.com/questions/7918868/how-to-escape-xml-entities-in-javascript>

### `invalidXMLCharacters`

```typescript
export const invalidXMLCharacters: RegExp;
```

A regular expression that matches invalid XML characters.

Use this to remove or replace invalid XML characters, or simply to detect that a string doesn’t contain them. This is particularly useful when generating XML based on user input.

This list is based on **Extensible Markup Language (XML) 1.1 (Second Edition), § 2.2 Characters** (https://www.w3.org/TR/xml11/#charsets). In particular, it includes:

1. `\u{0}`, which is always invalid in XML.
2. The gaps between the allowed ranges in the production rule for `[2] Char` from the “Character Range” grammar.
3. The discouraged characters from the **Note** in that section of the document.

Notably, it does **not** include the “"compatibility characters", as defined in Unicode” mentioned in that section of the document, because that list was difficult to find and doesn’t seem to be very important.

**Example**

```javascript
someUserInput.replace(invalidXMLCharacters, ""); // Remove invalid XML characters.
someUserInput.replace(invalidXMLCharacters, "�"); // Replace invalid XML characters with the Unicode replacement character.
someUserInput.match(invalidXMLCharacters); // Detect whether there are invalid XML characters.
```

**References**

- <https://www.w3.org/TR/xml/#charsets>: An older version of the XML standard.
- <https://en.wikipedia.org/wiki/Valid_characters_in_XML>
- <https://en.wikipedia.org/wiki/XML>
- <https://github.com/felixrieseberg/sanitize-xml-string/blob/661bd881613c0f7555eb7d73b883b853b9826cc6/src/index.ts>: It was the inspiration for this code. The differences are:
  1. We export the regular expression, instead of encapsulating it in auxiliary functions, which arguably makes it more useful.
  2. We are more strict on what we consider to be valid characters (see description above).
  3. We use the regular expression flag `v` instead of `u` (see <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/unicodeSets>).

<!-- DOCUMENTATION END: ./source/index.mts -->
