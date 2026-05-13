export type ResearchSource = {
  title?: string;
  url: string;
};

export type ResearchNotes = {
  shouldResearch: boolean;
  query?: string;
  notes: string[];
  cautions?: string[];
  sources?: ResearchSource[];
  error?: string;
};

export const emptyResearchNotes: ResearchNotes = {
  shouldResearch: false,
  notes: [],
  cautions: [],
  sources: [],
};
