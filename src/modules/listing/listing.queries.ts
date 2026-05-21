export const listingSummaryInclude = {
  address: true,
  owner: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { reviews: true } },
  reviews: { select: { rating: true } },
} as const;

export const listingOwnerInclude = {
  address: true,
  owner: { select: { id: true, name: true, avatarUrl: true } },
} as const;
