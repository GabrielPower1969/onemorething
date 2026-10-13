import { describe, expect, it } from "vitest";
import { parseYouTubeId } from "../../src/lib/youtube";

describe("parseYouTubeId", () => {
  const id = "UF8uR6Z6KLc";
  it.each([
    id,
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `youtu.be/${id}`,
  ])("accepts %s", (input) => expect(parseYouTubeId(input)).toBe(id));

  it.each([
    "",
    "not a url",
    "https://example.com/watch?v=UF8uR6Z6KLc",
    "https://youtube.com.evil.com/watch?v=UF8uR6Z6KLc",
    "javascript:alert(1)//youtu.be/UF8uR6Z6KLc",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=UF8uR6Z6KLc<script>",
  ])("rejects %s", (input) => expect(parseYouTubeId(input)).toBeNull());
});
