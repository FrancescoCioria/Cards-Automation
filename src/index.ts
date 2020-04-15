import { BaseEvent, Response } from "./model";
import { fromEither } from "fp-ts/lib/TaskEither";
import githubProjects from "./processors/githubProjects";
import * as camelcaseObject from "camelcase-object";
import * as crypto from "crypto";
import { failure } from "io-ts/lib/PathReporter";

const processEvent = async (event: unknown): Promise<Response> => {
  return fromEither(
    BaseEvent.decode(event).mapLeft(errors => {
      console.log(failure(errors).join("\n\n"));

      return {
        statusCode: 403,
        error: "Unknown Event"
      };
    })
  )
    .chain(baseEvent => {
      if (baseEvent.body.repository) {
        console.log(
          `new github event "${baseEvent.event}:${
            baseEvent.body.action
          }" from repo "${baseEvent.body.repository.fullName}"`
        );
      }

      return githubProjects(baseEvent);
    })
    .fold(
      e => ({
        statusCode: e.statusCode,
        body: e.error,
        headers: {
          "Content-Type": "text/plain"
        }
      }),
      () => ({
        statusCode: 200,
        body: "Ok",
        headers: {
          "Content-Type": "text/plain"
        }
      })
    )
    .run();
};

const verifySignature = (signature: string, payload: any): boolean => {
  const hmac = crypto.createHmac("sha1", process.env.WEBHOOK_SECRET!);
  const digest = Buffer.from(
    "sha1=" + hmac.update(payload).digest("hex"),
    "utf8"
  );
  const checksum = Buffer.from(signature, "utf8");

  return (
    checksum.length === digest.length &&
    crypto.timingSafeEqual(digest, checksum)
  );
};

export const githubWebhookListener = (event: {
  body: object;
  headers: any;
}): Promise<Response> => {
  if (
    verifySignature(
      event.headers["X-Hub-Signature"],
      JSON.stringify(event.body)
    )
  ) {
    return processEvent(
      camelcaseObject({
        body: event.body,
        event: event.headers["X-GitHub-Event"]
      })
    );
  } else {
    return Promise.resolve({
      statusCode: 401,
      body: "Unauthorized",
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
};
