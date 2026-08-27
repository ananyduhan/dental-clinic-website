import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * Pagination and search, shared by the list endpoints.
 *
 * `limit` is capped rather than merely validated: without a ceiling a crafted
 * `?limit=100000` dumps the table in one request.
 */
export const paginatedSearchSchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginatedSearch = z.infer<typeof paginatedSearchSchema>;
