import BetterSQLite3Database from "better-sqlite3";

/**
 * An extension of [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3)’s `Database` which includes:
 *
 * 1. A simpler way to run queries using tagged templates instead of managing prepared statements by hand.
 *
 * 2. A migration system.
 *
 * To appreciate the difference in ergonomics between `better-sqlite3` and `@radically-straightforward/sqlite`, consider the following example:
 *
 * **`better-sqlite3`**
 *
 * ```javascript
 * import Database from "better-sqlite3";
 *
 * const database = new Database("example.db");
 *
 * database.exec(
 *   `
 *     CREATE TABLE "users" (
 *       "id" INTEGER PRIMARY KEY AUTOINCREMENT,
 *       "name" TEXT
 *     );
 *   `,
 * );
 *
 * const insertStatement = database.prepare(
 *   `INSERT INTO "users" ("name") VALUES (?)`,
 * );
 * insertStatement.run("Leandro Facchinetti");
 *
 * const selectStatement = database.prepare(
 *   `SELECT "id", "name" FROM "users" WHERE "name" = ?`,
 * );
 * console.log(selectStatement.get("Leandro Facchinetti")); // => { id: 1, name: 'Leandro Facchinetti' }
 * ```
 *
 * 1. You must manage the prepared statements yourself, making sure to reuse them as much as possible. You could choose to not do that and create a new prepared statement every time instead, but that would be much slower.
 *
 * 2. The queries and their corresponding binding parameters are specified separately. In this simple example they’re just one line apart, but in general they could be far from each other, which makes the program more difficult to maintain.
 *
 * 3. When you run the program above for the second time, it fails because the `users` table already exists. In this simple example you could work around that by using `CREATE TABLE IF NOT EXISTS`, but for anything more complicated you need a migration system.
 *
 * **`@radically-straightforward/sqlite`**
 *
 * ```javascript
 * import sql, { Database } from "@radically-straightforward/sqlite";
 *
 * const database = new Database("example.db");
 *
 * await database.migrate(
 *   sql`
 *     CREATE TABLE "users" (
 *       "id" INTEGER PRIMARY KEY AUTOINCREMENT,
 *       "name" TEXT
 *     );
 *   `,
 * );
 *
 * database.run(
 *   sql`
 *     INSERT INTO "users" ("name") VALUES (${"Leandro Facchinetti"})
 *   `,
 * );
 *
 * console.log(
 *   database.get(
 *     sql`
 *       SELECT "id", "name" FROM "users" WHERE "name" = ${"Leandro Facchinetti"}
 *     `,
 *   ),
 * ); // => { id: 1, name: 'Leandro Facchinetti' }
 * ```
 *
 * 1. `@radically-straightforward/sqlite` manages the prepared statements for you, and makes sure to reuse them as much as possible.
 *
 * 2. The queries and their corresponding binding parameters are specified together, using interpolation in the `` sql`___` `` tagged template.
 *
 *    > **Note:** `@radically-straightforward/sqlite` does **not** do simple string interpolation, which would lead to SQL injection vulnerabilities. Under the hood `@radically-straightforward/sqlite` uses bind parameters similar to the `better-sqlite3` example.
 *
 *    > **Note:** The `` sql`___` `` tagged template makes the **[es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html)** Visual Studio Code extension syntax highlight SQL in tagged templates.
 *
 * 3. You may run the program above many times and it will not fail, because it’s using `@radically-straightforward/sqlite`’s migration system.
 */
export class Database extends BetterSQLite3Database {
  #statements = new Map<string, BetterSQLite3Database.Statement>();

  /**
   * A migration system based on [the steps for general schema changes in SQLite](https://www.sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes). The migration system implements steps 1–2, 10–12, and you must implement steps 3–9 in the migrations that you define.
   *
   * A migration may be:
   *
   * 1. A SQL query, for example:
   *
   *    ```javascript
   *    sql`
   *      CREATE TABLE "users" (
   *        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
   *        "name" TEXT
   *      );
   *    `;
   *    ```
   *
   * 2. A function, which may be asynchronous:
   *
   *    ```javascript
   *    async () => {
   *      database.execute(
   *        sql`
   *          INSERT INTO "users" ("name") VALUES (${"Leandro Facchinetti"});
   *        `,
   *      );
   *    };
   *    ```
   *
   *    > **Note:** For convenience, a migration function receives the database as a parameter. This can be useful if you want to define migrations in separate files.
   *
   * **Guidelines**
   *
   * 1. As your application evolves, append migrations to the call to `migrate()` but don’t edit or remove existing migrations. Think of the call to `migrate()` as an immutable record of the history of your database schema.
   *
   * 2. Run `migrate()` as your application starts, so that the database schema is always up-to-date.
   *
   * 3. Don’t call `migrate()` multiple times in your application.
   *
   * 4. The migration system guarantees that each migration will run successfully at most once. A migration is run in a transaction, and if it fails (for example, if it throws an exception), then the transaction is rolled back.
   *
   *    > **Note:** A migration that fails to run in the middle may still have had side-effects up to the point of failure, for example, having written a file to the filesystem, and that could cause issues. Make migrations as free of side-effects as possible.
   *
   * 5. The migration system doesn’t include a way to roll back a migration that has already run successfully. Instead, when necessary, you must create a new migration that undoes the work of the problematic migration.
   *
   *    > **Why?** This makes managing migrations more obviously correct, and in any non-trivial case rollback is impossible anyway, for example, if a migration involves dropping a table, then rolling it back would involve bringing back data that has been deleted.
   *
   * 6. The migration system sets the `journal_mode` to WAL. See <https://github.com/WiseLibs/better-sqlite3/blob/bd55c76c1520c7796aa9d904fe65b3fb4fe7aac0/docs/performance.md> and <https://www.sqlite.org/wal.html>.
   *
   * 7. You may consult the status of your database schema with the pragma `user_version`, which holds the number of migrations that have been run successfully.
   */
  async migrate(
    ...migrations: (Query | ((database: this) => void | Promise<void>))[]
  ): Promise<this> {
    this.pragma<void>(`journal_mode = WAL`);
    const foreignKeys =
      this.pragma<number>("foreign_keys", { simple: true }) === 1;
    if (foreignKeys) this.pragma<void>("foreign_keys = OFF");
    try {
      for (
        let migrationIndex = this.pragma<number>("user_version", {
          simple: true,
        });
        migrationIndex < migrations.length;
        migrationIndex++
      )
        try {
          this.execute(
            sql`
              BEGIN;
            `,
          );
          const migration = migrations[migrationIndex];
          if (typeof migration === "function") await migration(this);
          else this.execute(migration);
          if (foreignKeys) {
            const foreignKeyViolations =
              this.pragma<unknown[]>("foreign_key_check");
            if (foreignKeyViolations.length !== 0)
              throw new Error(
                `Foreign key violations in migration:\n${JSON.stringify(
                  foreignKeyViolations,
                  undefined,
                  2,
                )}`,
              );
          }
          this.pragma<void>(`user_version = ${migrationIndex + 1}`);
          this.execute(
            sql`
              COMMIT;
            `,
          );
        } catch (error) {
          this.execute(
            sql`
              ROLLBACK;
            `,
          );
          throw error;
        }
    } finally {
      if (foreignKeys) this.pragma<void>("foreign_keys = ON");
    }
    return this;
  }

  /**
   * Execute DDL statements, for example, `CREATE TABLE`, `DROP INDEX`, and so forth. Multiple statements may be included in the same query.
   */
  execute(query: Query): this {
    let source = "";
    for (
      let parametersIndex = 0;
      parametersIndex < query.parameters.length;
      parametersIndex++
    )
      source +=
        query.sourceParts[parametersIndex] +
        this.get<{ parameter: string }>(
          sql`
            SELECT quote(${query.parameters[parametersIndex]}) AS "parameter"
          `,
        )!.parameter;
    source += query.sourceParts.at(-1);
    return this.exec(source);
  }

  /**
   * Run a DML statement, for example, `INSERT`, `UPDATE`, `DELETE`, and so forth.
   */
  run(query: Query): BetterSQLite3Database.RunResult {
    return this.getStatement(query).run(...query.parameters);
  }

  /**
   * Run a `SELECT` statement that returns a single result.
   *
   * > **Note:** If the `SELECT` statement returns multiple results, only the first result is returned, so it’s better to write statements that return a single result, for example, using `ORDER BY` and `LIMIT`.
   *
   * > **Note:** You may also use `get()` to run an [`INSERT ... RETURNING *` statement](https://www.sqlite.org/lang_returning.html).
   *
   * > **Note:** The type parameter
   */
  get<T>(query: Query): T | undefined {
    return this.getStatement(query).get(...query.parameters) as T | undefined;
  }

  /**
   * Run a `SELECT` statement that returns multiple results as a list.
   */
  all<T>(query: Query): T[] {
    return this.getStatement(query).all(...query.parameters) as T[];
  }

  /**
   * Run a `SELECT` statement that returns multiple results as an iterator.
   */
  iterate<T>(query: Query): IterableIterator<T> {
    return this.getStatement(query).iterate(
      ...query.parameters,
    ) as IterableIterator<T>;
  }

  pragma<T>(source: string, options?: BetterSQLite3Database.PragmaOptions): T {
    return super.pragma(source, options) as T;
  }

  executeTransaction<T>(fn: () => T): T {
    return this.transaction(fn)();
  }

  executeTransactionImmediate<T>(fn: () => T): T {
    return this.transaction(fn).immediate();
  }

  executeTransactionExclusive<T>(fn: () => T): T {
    return this.transaction(fn).exclusive();
  }

  getStatement(query: Query): BetterSQLite3Database.Statement {
    const source = query.sourceParts.join("?");
    let statement = this.#statements.get(source);
    if (statement === undefined) {
      statement = this.prepare(source);
      this.#statements.set(source, statement);
    }
    return statement;
  }
}

export type Query = {
  sourceParts: string[];
  parameters: any[];
};

export default function sql(
  templateStrings: TemplateStringsArray,
  ...substitutions: any[]
): Query {
  const templateParts = [...templateStrings];
  const query: Query = { sourceParts: [], parameters: [] };
  for (
    let substitutionsIndex = 0;
    substitutionsIndex < substitutions.length;
    substitutionsIndex++
  ) {
    let templatePart = templateParts[substitutionsIndex];
    let substitution = substitutions[substitutionsIndex];
    if (substitution instanceof Set) substitution = [...substitution];
    if (templatePart.endsWith("$")) {
      templatePart = templatePart.slice(0, -1);
      if (
        !Array.isArray(substitution.sourceParts) ||
        substitution.sourceParts.length === 0 ||
        substitution.sourceParts.some(
          (sourcePart: any) => typeof sourcePart !== "string",
        ) ||
        !Array.isArray(substitution.parameters) ||
        substitution.sourceParts.length !== substitution.parameters.length + 1
      )
        throw new Error(
          `Failed to interpolate raw query ‘${substitution}’ because it wasn’t created with the sql\`___\` tagged template.`,
        );
      const substitutionQuery = substitution as Query;
      if (substitutionQuery.sourceParts.length === 1)
        templateParts[substitutionsIndex + 1] = `${templatePart}${
          substitutionQuery.sourceParts[0]
        }${templateParts[substitutionsIndex + 1]}`;
      else {
        query.sourceParts.push(
          `${templatePart}${substitutionQuery.sourceParts[0]}`,
          ...substitutionQuery.sourceParts.slice(1, -1),
        );
        templateParts[substitutionsIndex + 1] =
          `${substitutionQuery.sourceParts.at(-1)}${
            templateParts[substitutionsIndex + 1]
          }`;
        query.parameters.push(...substitutionQuery.parameters);
      }
    } else if (Array.isArray(substitution)) {
      if (substitution.length === 0)
        templateParts[substitutionsIndex + 1] = `${templatePart}()${
          templateParts[substitutionsIndex + 1]
        }`;
      else {
        query.sourceParts.push(
          `${templatePart}(`,
          ...new Array(substitution.length - 1).fill(","),
        );
        templateParts[substitutionsIndex + 1] = `)${
          templateParts[substitutionsIndex + 1]
        }`;
        query.parameters.push(...substitution);
      }
    } else {
      query.sourceParts.push(templatePart);
      query.parameters.push(substitution);
    }
  }
  query.sourceParts.push(templateParts.at(-1)!);
  return query;
}
