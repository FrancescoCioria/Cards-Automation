import { App } from "@octokit/app";
import { BaseEvent, Response } from "./model";
import { tryCatch, TaskEither } from "fp-ts/lib/TaskEither";
import { APP_ID, PRIVATE_KEY } from "./githubAppCredentials";

const githubApp = new App({ id: APP_ID, privateKey: PRIVATE_KEY });

const onError = (e: any) => {
  const error = JSON.stringify(e.message);
  console.error(`Github REST API response error:\n`, error);
  return error;
};

export default (event: BaseEvent): TaskEither<Response, string> => {
  return tryCatch(
    () =>
      githubApp.getInstallationAccessToken({
        installationId: event.body.installation.id
      }),
    onError
  ).mapLeft(() => ({ statusCode: 401, body: "Authentication Failed" }));
};
