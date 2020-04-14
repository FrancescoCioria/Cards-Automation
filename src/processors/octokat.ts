import axios from "axios";
import { tryCatch, TaskEither } from "fp-ts/lib/TaskEither";

axios.defaults = {
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github.inertia-preview+json"
  }
};

export const create = (url: string, data: any): TaskEither<string, unknown> => {
  return tryCatch(
    () => axios.post(url, data),
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
    () => axios.put(url, data),
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
    () => axios.delete(url),
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
