export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponseEnvelope<T> {
  success: true;
  data: readonly T[];
  pagination: PaginationMeta;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export function ok<T>(data: T): SuccessEnvelope<T> {
  return { success: true, data };
}

export function okPaginated<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResponseEnvelope<T> {
  return { success: true, data: rows, pagination: { page, pageSize, total } };
}
