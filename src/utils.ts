import { taskEither } from "fp-ts/lib/TaskEither";
import { array } from "fp-ts/lib/Array";

export const traverseTaskEither = array.traverse(taskEither);

export const getOwnerFromRepoFullName = (fullName: string): string => {
  return fullName.split("/")[0];
};
