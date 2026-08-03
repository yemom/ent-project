import type { PageResponse } from '@/types/api';

export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<PageResponse<T>>,
  pageSize = 100,
): Promise<PageResponse<T>> {
  const content: T[] = [];
  let lastResponse: PageResponse<T> | null = null;
  let page = 0;

  while (true) {
    const response = await fetchPage(page, pageSize);
    lastResponse = response;
    content.push(...(response.content ?? []));

    const isLastPage = response.last ?? response.content.length < pageSize;
    if (isLastPage) {
      break;
    }

    page += 1;
    if (page > 200) {
      break;
    }
  }

  const totalElements = lastResponse?.totalElements ?? content.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalElements / pageSize)) : 1;

  return {
    ...(lastResponse ?? {
      content: [],
      page: 0,
      size: pageSize,
      totalElements: 0,
      totalPages: 0,
      last: true,
    }),
    content,
    page: 0,
    size: content.length,
    totalElements,
    totalPages,
    last: true,
  };
}
