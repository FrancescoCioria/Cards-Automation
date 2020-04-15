import { BaseEvent, Response } from "./model";
import { fromEither } from "fp-ts/lib/TaskEither";
import githubProjects from "./processors/githubProjects";
import { identity } from "fp-ts/lib/function";
import * as camelcaseObject from "camelcase-object";
import { failure } from "io-ts/lib/PathReporter";
import { WEBHOOK_SECRET } from "./githubAppCredentials";

const processEvent = async (event: unknown): Promise<Response> => {
  return fromEither(
    BaseEvent.decode(event).mapLeft(errors => {
      console.log(failure(errors).join("\n\n"));

      return {
        statusCode: 403,
        body: "Unknown Event"
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
    .fold(identity, () => ({
      statusCode: 200,
      body: "Ok"
    }))
    .run();
};

export const githubWebhookListener = (event: {
  body: object;
  headers: any;
}): Promise<Response> => {
  if (event.headers["X-Hub-Signature"] === WEBHOOK_SECRET) {
    return processEvent(
      camelcaseObject({
        body: event.body,
        event: event.headers["X-GitHub-Event"]
      })
    );
  } else {
    return Promise.resolve({
      statusCode: 401,
      body: "Unauthorized"
    });
  }
};
