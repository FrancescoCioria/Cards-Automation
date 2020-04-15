import * as t from "io-ts";
import { GraphQLClient } from "graphql-request";
import { failure } from "io-ts/lib/PathReporter";
import { tryCatch, TaskEither } from "fp-ts/lib/TaskEither";
import * as taskEither from "fp-ts/lib/TaskEither";
import { GitHubEntity } from "../model";

const graphqlClient = () =>
  new GraphQLClient("https://api.github.com/graphql", {
    headers: {
      Accept:
        "application/vnd.github.inertia-preview+json, application/vnd.github.starfox-preview+json, application/vnd.github.mockingbird-preview+json, application/vnd.github.sailor-v-preview+json",
      Authorization: `token ${process.env.GITHUB_TOKEN}`
    }
  });

export const query = <A>(
  query: string,
  values: Record<string, unknown>,
  responseType: t.Type<A>
): TaskEither<string, A> => {
  return tryCatch(
    () => graphqlClient().request<unknown>(query, values),
    (e: any) => {
      const error = JSON.stringify(e.message);
      console.error(
        `Github graphql API response error for query ${query}:\n`,
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

const githubEntityFragment = `
  nodeId: id
  id: databaseId
`;

const repositoryFragment = `
  ${githubEntityFragment}
  name
  fullName: nameWithOwner
`;

const projectFragment = `
  ${githubEntityFragment}
  name
`;

const columnFragment = `
  ${githubEntityFragment}
  name
`;

const cardFragment = `
  ${githubEntityFragment}
`;

export const columnsAndRepositoryByCardQuery = `
  query ColumnsAndRepositoryByCard($nodeId: ID!) {
    card: node(id: $nodeId) {
      ... on ProjectCard {
        content {
          ... on Issue {
            repository {
              ${repositoryFragment}
            }
          }
          ... on PullRequest {
            repository {
              ${repositoryFragment}
            }
          }
        }
        project {
          columns(first: 100) {
            nodes {
              ${columnFragment}
            }
          }
        }
      }
    }
  }
`;

export const ColumnsAndRepositoryByCardResponse = t.type({
  card: t.type({
    content: t.type({
      repository: t.type({
        ...GitHubEntity.props,
        name: t.string,
        fullName: t.string
      })
    }),
    project: t.type({
      columns: t.type({
        nodes: t.array(t.type({ ...GitHubEntity.props, name: t.string }))
      })
    })
  })
});
export type ColumnsAndRepositoryByCardResponse = t.TypeOf<
  typeof ColumnsAndRepositoryByCardResponse
>;

export const addIssueCardToProjectQuery = `
  query AddIssueCardToProject($repositoryNodeId: ID!, $issueNodeId: ID!) {
    freshIssue: node(id: $issueNodeId) {
      ... on Issue {
        projectCards(first: 1) {
          nodes {
            project {
              name
            }
          }
        }
        labels(first: 100) {
          nodes {
            name
          }
        }
      }
    }
    repository: node(id: $repositoryNodeId) {
      ... on Repository {
        cardsAutomationProject: projects(search: "Cards Automation", states: OPEN, first: 1) {
          nodes {
            ${projectFragment}
            columns(first: 100) {
              nodes {
                ${columnFragment}
              }
            }
          }
        }
        fallbackProject: projects(states: OPEN, first: 1) {
          nodes {
            ${projectFragment}
            columns(first: 100) {
              nodes {
                ${columnFragment}
              }
            }
          }
        }
      }
    }

  }
`;

export const AddIssueCardToProjectResponse = t.type({
  freshIssue: t.type({
    projectCards: t.type({
      nodes: t.array(
        t.type({
          project: t.type({
            name: t.string
          })
        })
      )
    }),
    labels: t.type({
      nodes: t.array(
        t.type({
          name: t.string
        })
      )
    })
  }),
  repository: t.type({
    cardsAutomationProject: t.type({
      nodes: t.array(
        t.type({
          ...GitHubEntity.props,
          name: t.string,
          columns: t.type({
            nodes: t.array(
              t.type({
                ...GitHubEntity.props,
                name: t.string
              })
            )
          })
        })
      )
    }),
    fallbackProject: t.type({
      nodes: t.array(
        t.type({
          ...GitHubEntity.props,
          name: t.string,
          columns: t.type({
            nodes: t.array(
              t.type({
                ...GitHubEntity.props,
                name: t.string
              })
            )
          })
        })
      )
    })
  })
});
export type AddIssueCardToProjectResponse = t.TypeOf<
  typeof AddIssueCardToProjectResponse
>;

export const moveIssueCardToClosedQuery = `
  query MoveIssueCardToClosed($nodeId: ID!) {
    issue: node(id: $nodeId) {
      ... on Issue {
        projectCards(first: 1) {
          nodes {
            ${cardFragment}
            project {
              ${projectFragment}
              name
              columns(first: 100) {
                nodes {
                  ${columnFragment}
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const MoveIssueCardToClosedResponse = t.type({
  issue: t.type({
    projectCards: t.type({
      nodes: t.array(
        t.type({
          ...GitHubEntity.props,
          project: t.type({
            ...GitHubEntity.props,
            name: t.string,
            columns: t.type({
              nodes: t.array(
                t.type({
                  ...GitHubEntity.props,
                  name: t.string
                })
              )
            })
          })
        })
      )
    })
  })
});
export type MoveIssueCardToClosedResponse = t.TypeOf<
  typeof MoveIssueCardToClosedResponse
>;

export const maybeMoveIssueCardToWorkflowColumnQuery = `
  query MaybeMoveIssueCardToWorkflowColumn($nodeId: ID!) {
    issue: node(id: $nodeId) {
      ... on Issue {
        projectCards(first: 1) {
          nodes {
            ${cardFragment}
            column {
              ${columnFragment}
            }
            project {
              ${projectFragment}
              columns(first: 100) {
                nodes {
                  ${columnFragment}
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const MaybeMoveIssueCardToWorkflowColumnResponse = t.type({
  issue: t.type({
    projectCards: t.type({
      nodes: t.array(
        t.type({
          ...GitHubEntity.props,
          column: t.type({
            ...GitHubEntity.props
          }),
          project: t.type({
            ...GitHubEntity.props,
            name: t.string,
            columns: t.type({
              nodes: t.array(
                t.type({
                  ...GitHubEntity.props,
                  name: t.string
                })
              )
            })
          })
        })
      )
    })
  })
});
export type MaybeMoveIssueCardToWorkflowColumnResponse = t.TypeOf<
  typeof MaybeMoveIssueCardToWorkflowColumnResponse
>;
