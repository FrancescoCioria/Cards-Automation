import * as t from "io-ts";
import * as Octokat from "octokat";
import { failure } from "io-ts/lib/PathReporter";
import { tryCatch, TaskEither } from "fp-ts/lib/TaskEither";
import * as taskEither from "fp-ts/lib/TaskEither";

const github = () =>
  new Octokat({
    token: process.env.GITHUB_TOKEN,
    acceptHeader: "application/vnd.github.inertia-preview+json"
  });

export const fetch = <A>(
  url: string,
  responseType: t.Type<A>
): TaskEither<string, A> => {
  return tryCatch(
    () =>
      github()
        .fromUrl(url)
        .fetch(),
    (e: any) => {
      const error = JSON.stringify(e.message);
      console.error(
        `Github REST fetch API response error for url ${url}:\n`,
        error
      );
      return error;
    }
  ).chain(res => {
    return taskEither.fromEither(responseType.decode(res)).mapLeft(errors => {
      const error = failure(errors).join("\n");
      console.error("Error while validating response type:\n", error);
      return error;
    });
  });
};

export const create = (url: string, data: any): TaskEither<string, unknown> => {
  return tryCatch(
    () =>
      github()
        .fromUrl(url)
        .create(data),
    (e: any) => {
      const error = JSON.stringify(e.message);
      console.error(
        `Github REST create API response error for url ${url} with data ${JSON.stringify(
          data
        )}:\n`,
        error
      );
      return error;
    }
  );
};

export const update = (url: string, data: any): TaskEither<string, unknown> => {
  return tryCatch(
    () =>
      github()
        .fromUrl(url)
        .update(data),
    (e: any) => {
      const error = JSON.stringify(e.message);
      console.error(
        `Github REST update API response error for url ${url} with data ${JSON.stringify(
          data
        )}:\n`,
        error
      );
      return error;
    }
  );
};

export const remove = (url: string): TaskEither<string, unknown> => {
  return tryCatch(
    () =>
      github()
        .fromUrl(url)
        .remove(),
    (e: any) => {
      const error = JSON.stringify(e.message);
      console.error(
        `Github REST remove API response error for url ${url}
        )}:\n`,
        error
      );
      return error;
    }
  );
};
