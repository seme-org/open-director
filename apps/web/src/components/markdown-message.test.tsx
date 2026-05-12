import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "./markdown-message";

describe("MarkdownMessage", () => {
  it("renders assistant markdown as structured HTML", () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage>
        {"- **Director Brief**: Created\n- `Recipe`: Ready"}
      </MarkdownMessage>,
    );

    expect(html).toContain("<ul");
    expect(html).toContain("<strong");
    expect(html).toContain("Director Brief");
    expect(html).toContain("<code");
    expect(html).toContain("Recipe");
  });

  it("preserves single newlines as breaks", () => {
    const html = renderToStaticMarkup(<MarkdownMessage>{"Line one\nLine two"}</MarkdownMessage>);

    expect(html).toContain("Line one");
    expect(html).toContain("<br");
    expect(html).toContain("Line two");
  });
});
