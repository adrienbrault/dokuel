export type HtmlTag = {
  tag: string;
  attrs: Record<string, string | boolean>;
  injectTo: "body";
};

export function webAnalyticsTags(_token: string | undefined): HtmlTag[] {
  return [];
}
