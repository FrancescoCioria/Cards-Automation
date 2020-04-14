import axios from "axios";
import { tryCatch, TaskEither } from "fp-ts/lib/TaskEither";

const restClient = () => {
  axios.defaults = {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.inertia-preview+json"
    }
  };

  return axios;
};

export const create = (url: string, data: any): TaskEither<string, unknown> => {
  return tryCatch(
    () => restClient().post(url, data),
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
    () => restClient().put(url, data),
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
    () => restClient().delete(url),
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
