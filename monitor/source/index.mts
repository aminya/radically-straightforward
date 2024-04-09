import url from "node:url";
import nodemailer from "nodemailer";
import * as node from "@radically-straightforward/node";
import * as utilities from "@radically-straightforward/utilities";
import html from "@radically-straightforward/html";

const configuration: {
  resources: Parameters<typeof fetch>[0][];
  email: {
    options: any;
    defaults: nodemailer.SendMailOptions;
  };
} = (await import(url.pathToFileURL(process.argv[2]).href)).default;

utilities.log(
  "MONITOR",
  "2.1.0",
  "START",
  JSON.stringify(configuration.resources),
);
process.once("beforeExit", () => {
  utilities.log("STOP");
});

const alerts = new Set<(typeof configuration)["resources"][number]>();
node.backgroundJob({ interval: 5 * 60 * 1000 }, async () => {
  for (const resource of configuration.resources) {
    log("START");

    try {
      const response = await fetch(resource, {
        signal: AbortSignal.timeout(60 * 1000),
      });
      if (!response.ok) throw new Error(`Response status ‘${response.status}’`);
      log("SUCCESS", String(response.status));
      if (alerts.has(resource))
        try {
          const sentMessageInfo = await nodemailer
            .createTransport(configuration.email.options)
            .sendMail({
              ...configuration.email.defaults,
              inReplyTo: `monitor/${JSON.stringify(resource).replace(/[^A-Za-z0-9]/gu, "-")}@monitor.leafac.com`,
              references: `monitor/${JSON.stringify(resource).replace(/[^A-Za-z0-9]/gu, "-")}@monitor.leafac.com`,
              subject: `⚠️ MONITOR: ‘${JSON.stringify(resource)}’`,
              html: html`<pre>😮‍💨 SUCCESS</pre>`,
            });
          log("ALERT SUCCESS SENT", sentMessageInfo.response ?? "");
          alerts.delete(resource);
        } catch (error: any) {
          log("CATASTROPHIC ERROR TRYING TO SEND ALERT SUCCESS", String(error));
        }
    } catch (error: any) {
      log("ERROR", String(error));
      if (alerts.has(resource))
        log("SKIP ALERT BECAUSE PREVIOUS ALERT HASN’T BEEN CLEARED YET");
      else
        try {
          const sentMessageInfo = await nodemailer
            .createTransport(configuration.email.options)
            .sendMail({
              ...configuration.email.defaults,
              inReplyTo: `monitor/${JSON.stringify(resource).replace(/[^A-Za-z0-9]/gu, "-")}@monitor.leafac.com`,
              references: `monitor/${JSON.stringify(resource).replace(/[^A-Za-z0-9]/gu, "-")}@monitor.leafac.com`,
              subject: `⚠️ MONITOR: ‘${JSON.stringify(resource)}’`,
              html: html`<pre>${String(error)}</pre>`,
            });
          log("ALERT ERROR SENT", sentMessageInfo.response ?? "");
          alerts.add(resource);
        } catch (error: any) {
          log("CATASTROPHIC ERROR TRYING TO SEND ALERT ERROR", String(error));
        }
    }

    function log(...messageParts: string[]) {
      utilities.log(JSON.stringify(resource), ...messageParts);
    }
  }
});
