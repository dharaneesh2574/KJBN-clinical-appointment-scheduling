import { DomainValidationError } from './validation';

export interface Pagination {
  readonly offset: number;
  readonly limit: number;
}
export interface Page<T> extends Pagination {
  readonly items: readonly T[];
  readonly total: number;
}
export function requirePagination(input: Pagination): Pagination {
  if (
    !Number.isInteger(input.offset) ||
    input.offset < 0 ||
    input.offset > 1000000 ||
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 100
  ) {
    throw new DomainValidationError('pagination');
  }
  return { offset: input.offset, limit: input.limit };
}
