export type RecipeWorkflowComponentName =
  | "language"
  | "script"
  | "art_style"
  | "storyboard"
  | "character"
  | "voice"
  | "bgm"
  | "media";

export type RecipeWorkflowComponent = {
  name: RecipeWorkflowComponentName;
  title: string;
  order: number;
  status: "pending";
  dependsOn: RecipeWorkflowComponentName[];
  agentName: string;
};

const storyWorkflowComponents = [
  {
    name: "language",
    title: "Language",
    order: 1,
    dependsOn: [],
    agentName: "language_agent",
  },
  {
    name: "script",
    title: "Script",
    order: 2,
    dependsOn: ["language"],
    agentName: "script_agent",
  },
  {
    name: "art_style",
    title: "Art Style",
    order: 3,
    dependsOn: ["script"],
    agentName: "art_style_agent",
  },
  {
    name: "storyboard",
    title: "Storyboard",
    order: 4,
    dependsOn: ["script"],
    agentName: "storyboard_agent",
  },
  {
    name: "character",
    title: "Characters",
    order: 5,
    dependsOn: ["script", "art_style", "storyboard"],
    agentName: "character_agent",
  },
  {
    name: "voice",
    title: "Voice",
    order: 6,
    dependsOn: ["storyboard", "character", "script"],
    agentName: "voice_agent",
  },
  {
    name: "bgm",
    title: "BGM",
    order: 7,
    dependsOn: ["storyboard", "script"],
    agentName: "bgm_agent",
  },
  {
    name: "media",
    title: "Media",
    order: 8,
    dependsOn: ["storyboard", "character"],
    agentName: "media_agent",
  },
] satisfies Array<Omit<RecipeWorkflowComponent, "status">>;

function withPendingStatus(
  component: Omit<RecipeWorkflowComponent, "status">,
): RecipeWorkflowComponent {
  return { ...component, status: "pending" };
}

export function getRecipeWorkflowComponents() {
  return storyWorkflowComponents.map(withPendingStatus);
}

export function getRecipeWorkflowPreviewComponents() {
  return getRecipeWorkflowComponents().map(
    ({ name, title, order, status }) => ({ name, title, order, status }),
  );
}

export const recipeWorkflowPreviewComponents =
  getRecipeWorkflowPreviewComponents();

export function planRecipeWorkflowBatches() {
  const components = getRecipeWorkflowComponents();
  const completed = new Set<RecipeWorkflowComponentName>();
  const remaining = new Map(components.map((component) => [component.name, component]));
  const batches: RecipeWorkflowComponentName[][] = [];

  while (remaining.size) {
    const ready = [...remaining.values()]
      .filter((component) =>
        component.dependsOn.every((dependency) => completed.has(dependency)),
      )
      .sort((a, b) => a.order - b.order);

    if (!ready.length) {
      throw new Error(
        `Recipe workflow has unsatisfied or cyclic dependencies: ${[
          ...remaining.keys(),
        ].join(", ")}`,
      );
    }

    batches.push(ready.map((component) => component.name));
    for (const component of ready) {
      completed.add(component.name);
      remaining.delete(component.name);
    }
  }

  return batches;
}
