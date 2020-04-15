# Cards Automation

GitHub App to automatically add and move cards in any GitHub Project based on their labels

## Install
You can install this app for free from https://github.com/apps/cards-automation

## Automations

- when you open a new issue, it creates a card for that issue into the first column of your project
- when you open a new issue with a label, it creates a card for that issue into the corresponding _TriageColumn_
- when you add a label to an issue, it moves its card into the corresponding _WorkflowColumn_
- when you move a card to a _WorkflowColumn_, it adds that label to the corresponding issue

### TriageColumns

When a new issue is opened, Cards Automation automatically creates a corresponding card in your project.

By default, the card is created in the first column of your project.

However, you can automate a simple triage based on the labels of the newly opened issue by creating one or more _TriageColumns_.

A _TriageColumn_ is a column with the suffix `[Triage_Label]` in its name:

![image](https://user-images.githubusercontent.com/4029499/36200446-f5b81772-117c-11e8-8d0a-67f1376da524.png)

In the example above, we've created a _TriageColumn_ to group all new issues created with the label `bug`.
<br />Now, whenever we open an issue with the label `bug`, Cards Automation will add its corresponding card to this column.

### StateColumns

When you add a label to an existing issue, Cards Automation automatically moves its card to the corresponding _WorkflowColumn_ of your project.

A _StateColumn_ is a column with the suffix `{State_Label}` in its name:

![image](https://user-images.githubusercontent.com/4029499/36201549-96f0aec6-1180-11e8-9151-46209c707614.png)

In the example above, we've created a _StateColumn_ to group all issues labeled `WIP`.
<br />Now, whenever we add the label `WIP` to an existing issue, Cards Automation will move its corresponding card to this column.

This also works backwards:
If you manually move an issue card to this colum, Cards Automation will add the label `WIP` to the corresponding issue
