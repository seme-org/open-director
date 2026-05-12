import { asStateRecord, textValue } from "./task-planner";

export function isCreateVideoCommand(prompt: string) {
  const value = prompt.trim().toLowerCase();
  return (
    value === "创作视频" ||
    value === "开始创作视频" ||
    value === "create video" ||
    value === "generate video"
  );
}

export function isDirectorBriefConfirmation(input: {
  confirmDirectorBrief?: unknown;
  directorBrief?: unknown;
}) {
  return (
    input.confirmDirectorBrief === true &&
    Boolean(input.directorBrief && typeof input.directorBrief === "object")
  );
}

export function confirmedDirectorBriefPrompt(
  prompt: string,
  directorBrief: unknown,
) {
  const brief = asStateRecord(directorBrief);
  const exam = asStateRecord(brief.exam);
  const lines: string[] = [prompt.trim()].filter(Boolean);
  const appendItems = (title: string, value: unknown) => {
    if (!Array.isArray(value) || !value.length) return;
    lines.push(`${title}:`);
    for (const rawItem of value) {
      const item = asStateRecord(rawItem);
      const label = textValue(item.label, textValue(item.key));
      const itemValue = textValue(item.value);
      if (label || itemValue) lines.push(`- ${label}: ${itemValue}`);
    }
  };
  const appendChoices = (title: string, value: unknown) => {
    if (!Array.isArray(value) || !value.length) return;
    lines.push(`${title}:`);
    for (const rawField of value) {
      const field = asStateRecord(rawField);
      const selected = Array.isArray(field.options)
        ? field.options
            .map(asStateRecord)
            .find((option) => Number(option.default) === 1)
        : undefined;
      lines.push(
        `- ${textValue(field.label, textValue(field.key))}: ${textValue(selected?.label, textValue(selected?.value))}`,
      );
    }
  };

  appendItems("Confirmed input parameters", exam.input_parameter);
  appendItems("Confirmed fill blanks", exam.fill_blank);
  appendChoices("Confirmed single choices", exam.single_choice);
  appendChoices("Confirmed multi choices", exam.multi_choice);
  return lines.join("\n");
}

export function extractAspectRatioFromPrompt(prompt: string) {
  const match = prompt.match(/(?:aspect\s*ratio|aspect_ratio)\s*[:：]\s*(16:9|9:16|1:1)/i);
  return match?.[1] as "16:9" | "9:16" | "1:1" | undefined;
}
