export type PlanningSubjectLike = {
  name?: unknown;
  type?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isReusableVisualSubject(subject: PlanningSubjectLike) {
  const type = textValue(subject.type).toLowerCase();
  return type === "character" || type === "object";
}

export function filterReusableVisualSubjects<T extends PlanningSubjectLike>(subjects: T[]) {
  return subjects.filter(isReusableVisualSubject);
}
