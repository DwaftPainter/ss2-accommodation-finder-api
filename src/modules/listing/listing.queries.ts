export const listingSummaryInclude = {
  address: true,
  owner: { select: { id: true, name: true, avatarUrl: true } },
} as const;

export const listingOwnerInclude = {
  address: true,
  owner: { select: { id: true, name: true, avatarUrl: true } },
} as const;
