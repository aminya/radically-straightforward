import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import got from "got";
import * as expressUtilities from "./index.mjs";

test("asyncHandler()", async () => {
  await (async () => {
    const app = express();

    app.get<
      { exampleParameter: string },
      { exampleResponseBody: string },
      { exampleRequestBody: string },
      { exampleRequestQuery: string },
      { exampleLocals: string }
    >("/error/:exampleParameter", (req, res) => {
      // Examples of using the types from the generics:
      if (false) {
        req.params.exampleParameter;
        res.send({ exampleResponseBody: "exampleResponseBody" });
        req.body.exampleRequestBody;
        req.query.exampleRequestQuery;
        res.locals.exampleLocals;
      }

      throw new Error("Error from the request handler");
    });

    // Adding the generics to ‘app.use<...>()’ doesn’t work. Don’t ask me why; @types/express is weird with error handlers.
    app.use(((err, req, res, next) => {
      // Examples of using the types from the generics:
      if (false) {
        req.params.exampleParameter;
        res.send({ exampleResponseBody: "exampleResponseBody" });
        req.body.exampleRequestBody;
        req.query.exampleRequestQuery;
        res.locals.exampleLocals;
      }

      throw new Error(`Decorated error from the error handler: ${err}`);
    }) as express.ErrorRequestHandler<
      { exampleParameter: string },
      { exampleResponseBody: string },
      { exampleRequestBody: string },
      { exampleRequestQuery: string },
      { exampleLocals: string }
    >);

    const server = app.listen();
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Invalid address");
    const port = address.port;

    assert(
      (
        await got
          .default(`http://localhost:${port}/error/hi`, {
            throwHttpErrors: false,
          })
          .text()
      ).includes(
        "Error: Decorated error from the error handler: Error: Error from the request handler",
      ),
    );
    assert(server.listening);

    server.close();
  })();

  await (async () => {
    const app = express();

    // Adding the generics to ‘app.get<...>()’ would also work, but it’s more consistent to add them to ‘asyncHandler<...>()’.
    app.get(
      "/error/:exampleParameter",
      asyncHandler<
        { exampleParameter: string },
        { exampleResponseBody: string },
        { exampleRequestBody: string },
        { exampleRequestQuery: string },
        { exampleLocals: string }
      >(async (req, res) => {
        // Examples of using the types from the generics:
        if (false) {
          req.params.exampleParameter;
          res.send({ exampleResponseBody: "exampleResponseBody" });
          req.body.exampleRequestBody;
          req.query.exampleRequestQuery;
          res.locals.exampleLocals;
        }

        await Promise.resolve();
        throw new Error("Error from the request handler");
      }),
    );

    // Adding the generics to ‘app.get<...>()’ would *not* work. Don’t ask me why; @types/express is weird with error handlers.
    app.use(
      asyncErrorHandler<
        { exampleParameter: string },
        { exampleResponseBody: string },
        { exampleRequestBody: string },
        { exampleRequestQuery: string },
        { exampleLocals: string }
      >(async (err, req, res, next) => {
        // Examples of using the types from the generics:
        if (false) {
          req.params.exampleParameter;
          res.send({ exampleResponseBody: "exampleResponseBody" });
          req.body.exampleRequestBody;
          req.query.exampleRequestQuery;
          res.locals.exampleLocals;
        }

        await Promise.resolve();
        throw new Error(`Decorated error from the error handler: ${err}`);
      }),
    );

    const server = app.listen();
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Invalid address");
    const port = address.port;

    assert(
      (
        await got
          .default(`http://localhost:${port}/error/hi`, {
            throwHttpErrors: false,
          })
          .text()
      ).includes(
        "Error: Decorated error from the error handler: Error: Error from the request handler",
      ),
    );
    assert(server.listening);

    server.close();
  })();
});