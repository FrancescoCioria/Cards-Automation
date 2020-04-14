import { BaseEvent, Response } from "./model";
import getToken from "./getToken";
import { prismaLog } from "./utils";
import { fromEither } from "fp-ts/lib/TaskEither";
import githubProjects from "./processors/githubProjects";
import { identity } from "fp-ts/lib/function";
import * as camelcaseObject from "camelcase-object";
import { failure } from "io-ts/lib/PathReporter";

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
      return getToken(baseEvent).map<BaseEvent>(installationAccessToken => {
        process.env.GITHUB_TOKEN = installationAccessToken;
        return baseEvent;
      });
    })
    .chain(baseEvent => {
      if (baseEvent.body.repository) {
        prismaLog(
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
  body: string;
  headers: any;
}): Promise<Response> => {
  return processEvent(
    camelcaseObject({
      body: event.body,
      event: event.headers["X-GitHub-Event"]
    })
  );
};
