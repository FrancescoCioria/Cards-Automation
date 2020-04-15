import * as t from "io-ts";

export type Response = {
  statusCode: number;
  body: string;
  headers: {
    "Content-Type": string;
  };
};

export type Error = {
  statusCode: number;
  error: string;
};

export const GitHubEntity = t.type({
  id: t.number,
  nodeId: t.string
});
export type GitHubEntity = t.TypeOf<typeof GitHubEntity>;

export const User = t.type({
  id: t.number,
  login: t.string
});
export type User = t.TypeOf<typeof User>;

export const Column = t.type({
  ...GitHubEntity.props,
  name: t.string
});
export type Column = t.TypeOf<typeof Column>;

export const Project = t.type({
  ...GitHubEntity.props,
  name: t.string
});
export type Project = t.TypeOf<typeof Project>;

export const SimpleProject = t.type({
  ...GitHubEntity.props,
  name: t.string
});
export type SimpleProject = t.TypeOf<typeof SimpleProject>;

export const Card = t.type({
  ...GitHubEntity.props
});
export type Card = t.TypeOf<typeof Card>;

export const CardFromEvent = t.type({
  ...Card.props,
  note: t.null, // filter out "notes"
  columnId: t.number,
  contentUrl: t.string
});

export type CardFromEvent = t.TypeOf<typeof CardFromEvent>;

export const Issue = t.type({
  ...GitHubEntity.props,
  title: t.string,
  number: t.number,
  state: t.keyof({ open: true, closed: true }),
  body: t.union([t.null, t.string]),
  labels: t.array(t.type({ name: t.string }))
});

export type Issue = t.TypeOf<typeof Issue>;

export const Repository = t.type({
  ...GitHubEntity.props,
  fullName: t.string,
  name: t.string
});
export type Repository = t.TypeOf<typeof Repository>;

// Events

export const BaseEvent = t.type({
  event: t.string,
  body: t.type({
    action: t.union([t.undefined, t.string]),
    repository: t.union([t.undefined, Repository]),
    sender: User,
    installation: t.type({
      id: t.number
    })
  })
});
export type BaseEvent = t.TypeOf<typeof BaseEvent>;

export const IssueEvent = t.type({
  event: t.literal("issues"),
  body: t.type({
    sender: User,
    issue: Issue,
    repository: Repository,
    action: t.keyof({ opened: true, closed: true, labeled: true }),
    label: t.union([t.type({ name: t.string }), t.undefined]),
    installation: t.type({
      id: t.number
    })
  })
});
export type IssueEvent = t.TypeOf<typeof IssueEvent>;

export const ProjectCardEvent = t.type({
  event: t.literal("project_card"),
  body: t.union([
    t.type({
      sender: User,
      projectCard: CardFromEvent,
      repository: t.union([t.undefined, Repository]),
      action: t.literal("moved"),
      changes: t.type({
        columnId: t.type({
          from: t.number
        })
      }),
      installation: t.type({
        id: t.number
      })
    }),
    t.type({
      sender: User,
      projectCard: CardFromEvent,
      repository: t.union([t.undefined, Repository]),
      action: t.keyof({ created: true, converted: true }),
      installation: t.type({
        id: t.number
      })
    })
  ])
});
export type ProjectCardEvent = t.TypeOf<typeof ProjectCardEvent>;
