export const parsePaginationParams = (query, defaults = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxLimit = 50
  } = defaults

  const pageInput = Number.parseInt(query.page, 10)
  const limitInput = Number.parseInt(query.limit, 10)

  const page = Number.isFinite(pageInput) && pageInput > 0 ? pageInput : defaultPage
  const limit = Number.isFinite(limitInput) && limitInput > 0
    ? Math.min(limitInput, maxLimit)
    : defaultLimit

  return {
    page,
    limit,
    skip: (page - 1) * limit
  }
}
