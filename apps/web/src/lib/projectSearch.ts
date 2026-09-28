export type ProjectSort = "name" | "updated";
export type SortOrder = "asc" | "desc";

export type ProjectSearch = {
  q?: string;
  sort?: ProjectSort;
  order?: SortOrder;
};

export function validateProjectSearch(
  search: Record<string, unknown>,
): ProjectSearch {
  return {
    q: typeof search.q === "string" && search.q !== "" ? search.q : undefined,
    sort: search.sort === "updated" ? "updated" : undefined,
    order:
      search.order === "asc" || search.order === "desc"
        ? search.order
        : undefined,
  };
}

export const DEFAULT_ORDER: Record<ProjectSort, SortOrder> = {
  name: "asc",
  updated: "desc",
};
