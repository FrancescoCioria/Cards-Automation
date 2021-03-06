import * as t from "io-ts";
import { startsWith, some, flatten } from "lodash";
import { traverseTaskEither } from "../utils";
import {
  Column,
  Issue,
  CardFromEvent,
  IssueEvent,
  ProjectCardEvent,
  BaseEvent,
  Repository,
  Error
} from "../model";
import { create, remove, update } from "./rest";
import { TaskEither, fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { findFirst, head } from "fp-ts/lib/Array";
import {
  query,
  AddIssueCardToProjectResponse,
  addIssueCardToProjectQuery,
  moveIssueCardToClosedQuery,
  MoveIssueCardToClosedResponse,
  maybeMoveIssueCardToWorkflowColumnQuery,
  MaybeMoveIssueCardToWorkflowColumnResponse,
  columnsAndRepositoryByCardQuery,
  ColumnsAndRepositoryByCardResponse
} from "./graphql";
import { fromNullable } from "fp-ts/lib/Option";
import { identity } from "fp-ts/lib/function";
import getToken from "../getToken";

const isColumnOpened = (column: Column): boolean =>
  startsWith(column.name, "(n)");
const isColumnClosed = (column: Column): boolean =>
  startsWith(column.name, "(d)");

const getColumnWorkflowLabels = (column: Column): string[] => {
  const workflowRegExp = /(.+)?\{(.+)\}/;

  const regExpRes = workflowRegExp.exec(column.name);
  const workflowColumns = regExpRes ? regExpRes[2] : "";

  return workflowColumns
    .split(",")
    .map(workflowColumn => workflowColumn.trim())
    .filter(w => w);
};

const getAllWorkflowLabels = (columns: Column[]): string[] => {
  return flatten(columns.map(getColumnWorkflowLabels));
};

const getColumnCategoryLabels = (column: Column): string[] => {
  const categoryRegExp = /(.+)?\[(.+)\]/;

  const regExpRes = categoryRegExp.exec(column.name);
  const categoryColumns = regExpRes ? regExpRes[2] : "";

  return categoryColumns
    .split(",")
    .map(categoryColumn => categoryColumn.trim())
    .filter(cl => cl);
};

const getIssueNumberFromCard = (card: CardFromEvent): number => {
  return parseInt(card.contentUrl.split("/").pop()!);
};

function moveCardToColumn(
  cardId: number,
  columnId: number
): TaskEither<string, unknown> {
  return create(
    `https://api.github.com/projects/columns/cards/${cardId}/moves`,
    {
      position: "top",
      column_id: columnId
    }
  );
}

function removeLabelFromIssue(
  repoFullName: string,
  issueNumber: number,
  labelName: string
): TaskEither<string, unknown> {
  return remove(
    `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels/${labelName}`
  );
}

function addIssueCardToProject(
  repository: Repository,
  issue: Issue
): TaskEither<string, void> {
  return query(
    addIssueCardToProjectQuery,
    { repositoryNodeId: repository.nodeId, issueNodeId: issue.nodeId },
    AddIssueCardToProjectResponse
  ).chain(res => {
    const issueProject = head(res.freshIssue.projectCards.nodes);

    if (issueProject.isSome()) {
      return fromLeft(
        `The issue "${repository.fullName}#${
          issue.number
        }" is already linked to a card in the project "${
          issueProject.value.project.name
        }"`
      );
    }
    const cardsAutomationProject = head(
      res.repository.cardsAutomationProject.nodes
    );
    const fallbackProject = head(res.repository.fallbackProject.nodes);

    if (fallbackProject.isNone()) {
      return fromLeft(
        `repository "${repository.fullName}" does not have any GitHub Projects`
      );
    }

    const project = cardsAutomationProject.foldL(() => {
      console.log(
        `repository "${
          repository.fullName
        }" is missing a \"Cards Automation\" project: falling back to "${
          fallbackProject.value.name
        }" project`
      );

      return fallbackProject.value;
    }, identity);

    const labels = res.freshIssue.labels.nodes;
    const columns = project.columns.nodes;

    const columnOpened = findFirst(columns, isColumnOpened);
    const categoryColumn = findFirst(columns, c => {
      const columnCategoryLabels = getColumnCategoryLabels(c).map(cl =>
        cl.toLowerCase()
      );
      return some(labels, l =>
        columnCategoryLabels.includes(l.name.toLowerCase())
      );
    });

    const startColumn = categoryColumn.fold(
      columnOpened.foldL(() => {
        console.log(
          `project "${project.name}" in repo "${
            repository.fullName
          }" is missing the column for opened issues (should be named "(n) column_name")\nfalling back to the first column of the project`
        );
        return columns[0];
      }, identity),
      identity
    );

    // create card
    return create(
      `https://api.github.com/projects/columns/${startColumn.id}/cards`,
      {
        content_id: issue.id,
        content_type: "Issue"
      }
    ).map(() => {
      console.log(
        `Card for issue "${issue.title}" in repo "${
          repository.fullName
        }" added to the column "${startColumn.name}" of the project "${
          project.name
        }"`
      );
    });
  });
}

function moveIssueCardToClosed(
  repoFullName: string,
  issue: Issue
): TaskEither<string, unknown> {
  return query(
    moveIssueCardToClosedQuery,
    { nodeId: issue.nodeId },
    MoveIssueCardToClosedResponse
  ).chain(res => {
    const card = head(res.issue.projectCards.nodes);

    if (card.isNone()) {
      return fromLeft(
        `issue "${
          issue.title
        }" in repo "${repoFullName}" is not linked to any card`
      );
    }

    const columnClosed = findFirst(
      card.value.project.columns.nodes,
      isColumnClosed
    );
    if (columnClosed.isNone()) {
      return fromLeft(
        `project "${
          card.value.project.name
        }" in repo "${repoFullName}" is missing the column for closed issues (should be named "(d) column_name")`
      );
    }

    // move card
    return moveCardToColumn(card.value.id, columnClosed.value.id);
  });
}

function maybeMoveIssueCardToWorkflowColumn(
  repoFullName: string,
  issue: Issue,
  newLabel: Issue["labels"][number]
): TaskEither<string, unknown> {
  return query(
    maybeMoveIssueCardToWorkflowColumnQuery,
    { nodeId: issue.nodeId },
    MaybeMoveIssueCardToWorkflowColumnResponse
  ).chain(res => {
    return head(res.issue.projectCards.nodes).fold(
      taskEither.of(undefined),
      card => {
        const columns = card.project.columns.nodes;

        const workflowColumn = findFirst(columns, c => {
          const columnWorkflowLabels = getColumnWorkflowLabels(c).map(wl =>
            wl.toLowerCase()
          );
          return columnWorkflowLabels.includes(newLabel.name.toLowerCase());
        });

        if (workflowColumn.isNone()) {
          return taskEither.of(undefined);
        }

        const workflowLabels = getAllWorkflowLabels(columns);

        const existingWorkflowLabel = findFirst(
          issue.labels,
          l =>
            workflowLabels.includes(l.name.toLowerCase()) &&
            l.name !== newLabel.name
        );

        return taskEither
          .of<string, unknown>(undefined)
          .chain(() => {
            if (existingWorkflowLabel.isSome()) {
              return removeLabelFromIssue(
                repoFullName,
                issue.number,
                existingWorkflowLabel.value.name
              );
            }

            return taskEither.of(undefined);
          })
          .chain(() => {
            if (workflowColumn.value.id !== card.column.id) {
              return moveCardToColumn(card.id, workflowColumn.value.id);
            }

            return taskEither.of(undefined);
          });
      }
    );
  });
}

function maybeUpdateWorkflowLabels(
  repoFullName: string,
  card: CardFromEvent,
  columns: Column[]
): TaskEither<string, unknown> {
  const column = findFirst(columns, column => column.id === card.columnId);
  const columnWorkflowLabels = column.fold([], getColumnWorkflowLabels);

  if (columnWorkflowLabels.length > 0) {
    const workflowLabels = getAllWorkflowLabels(columns);
    const issueNumber = getIssueNumberFromCard(card);

    if (!isNaN(issueNumber)) {
      // blindly remove any workflow label from issue
      traverseTaskEither(
        workflowLabels.filter(wl => !columnWorkflowLabels.includes(wl)),
        labelName => removeLabelFromIssue(repoFullName, issueNumber, labelName)
      ).run();

      // add correct workflow label
      return create(
        `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`,
        [{ name: columnWorkflowLabels[0] }]
      );
    }
  }

  return taskEither.of(undefined);
}

function maybeCloseIssue(
  repoFullName: string,
  card: CardFromEvent,
  columns: Column[]
): TaskEither<string, unknown> {
  const column = findFirst(
    columns,
    column => column.id === card.columnId
  ).filter(isColumnClosed);

  if (column.isSome()) {
    // blindly close issue
    update(
      `https://api.github.com/repos/${repoFullName}/issues/${getIssueNumberFromCard(
        card
      )}`,
      { state: "closed" }
    ).run();

    return taskEither.of(undefined);
  }

  return taskEither.of(undefined);
}

const isEvent = <A>(type: t.Type<A>, event: unknown): event is A => {
  return type.decode(event).isRight();
};

const buildError = (error: string): Error => ({
  statusCode: 500,
  error
});

const saveTokenToSession = (event: BaseEvent): TaskEither<Error, unknown> => {
  return getToken(event).map(installationAccessToken => {
    process.env.GITHUB_TOKEN = installationAccessToken;
  });
};

export default (event: BaseEvent): TaskEither<Error, unknown> => {
  if (event.body.sender.login === "projects-automation[bot]") {
    return fromLeft(
      buildError(
        `Ignored event "${event.event}" as sender is "projects-automation[bot]"`
      )
    );
  } else if (isEvent(IssueEvent, event)) {
    const { action, issue, label } = event.body;
    const repoFullName = event.body.repository.fullName;

    if (action === "opened") {
      // new issue
      console.log(`New issue "${issue.title}" added to repo "${repoFullName}"`);
      return saveTokenToSession(event).chain(() =>
        addIssueCardToProject(event.body.repository, issue).mapLeft(buildError)
      );
    } else if (action === "closed") {
      // issue closed
      console.log(
        `Issue "${issue.title}" in repo "${repoFullName}" has been closed`
      );
      return saveTokenToSession(event).chain(() =>
        moveIssueCardToClosed(repoFullName, issue).mapLeft(buildError)
      );
    } else if (action === "labeled" && issue.state !== "closed" && label) {
      // issue labeled
      console.log(
        `Issue "${
          issue.title
        }" in repo "${repoFullName}" has been labeled as "${label.name}"`
      );
      return saveTokenToSession(event).chain(() =>
        maybeMoveIssueCardToWorkflowColumn(repoFullName, issue, label).mapLeft(
          buildError
        )
      );
    }
  } else if (isEvent(ProjectCardEvent, event)) {
    const { projectCard: card } = event.body;

    if (
      event.body.action === "created" ||
      event.body.action === "converted" ||
      (event.body.action === "moved" &&
        event.body.changes.columnId.from !== card.columnId)
    ) {
      // issue card manually created or moved to different column

      if (event.body.repository) {
        console.log(
          `Card "${card.id}" in repo "${
            event.body.repository.fullName
          }" has been moved/added to the column "${card.columnId}"`
        );
      } else {
        console.log(
          `Card "${card.id}" in org ... has been moved/added to the column "${
            card.columnId
          }"`
        );
      }

      return saveTokenToSession(event).chain(() =>
        query(
          columnsAndRepositoryByCardQuery,
          { nodeId: card.nodeId },
          ColumnsAndRepositoryByCardResponse
        )
          .chain(res => {
            const repoFullName = res.card.content.repository.fullName;
            const columns = res.card.project.columns.nodes;
            return maybeUpdateWorkflowLabels(repoFullName, card, columns).chain(
              () => maybeCloseIssue(repoFullName, card, columns)
            );
          })
          .mapLeft(() => buildError("Internal Server Error"))
      );
    }
  } else {
    console.log(
      `\nIgnored event "${event.event}${fromNullable(
        (event.body as any).action
      ).fold("", a => `:${a}`)}" \n`
    );
  }

  return taskEither.of(undefined);
};
