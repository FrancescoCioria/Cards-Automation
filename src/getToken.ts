import { App } from "@octokit/app";
import { BaseEvent, Error } from "./model";
import { tryCatch, TaskEither } from "fp-ts/lib/TaskEither";

const begin = "-----BEGIN RSA PRIVATE KEY-----";
const end = "-----END RSA PRIVATE KEY-----";
const privateKeyOnMultipleLines = process.env
  .PRIVATE_KEY!.replace(begin, "")
  .replace(end, "")
  .split(" ")
  .join("\n");

const privateKey = () => `${begin}${privateKeyOnMultipleLines}${end}`;

const githubApp = new App({
  id: parseInt(process.env.APP_ID!),
  privateKey: privateKey()
});

const onError = (e: any) => {
  const error = JSON.stringify(e.message);
  console.error(`Github REST API response error:\n`, error);
  return error;
};

export default (event: BaseEvent): TaskEither<Error, string> => {
  return tryCatch(
    () =>
      githubApp.getInstallationAccessToken({
        installationId: event.body.installation.id
      }),
    onError
  ).mapLeft(() => ({ statusCode: 401, error: "Authentication Failed" }));
};
