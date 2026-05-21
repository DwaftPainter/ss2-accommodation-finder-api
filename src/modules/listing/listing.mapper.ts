import type { Prisma } from '@prisma/client';
import type { ListingSearchDoc } from '../../integrations/opensearch/opensearch.service';

type ListingWithAddress = Prisma.ListingGetPayload<{
  include: { address: true };
}>;

type ListingWithRating = Prisma.ListingGetPayload<{
  include: {
    address: true;
    owner: { select: { id: true; name: true; avatarUrl: true } };
  };
}>;

export interface ListingRatingStats {
  avgRating: number;
  reviewCount: number;
}

export function averageRating(reviews: Array<{ rating: number }>) {
  if (reviews.length === 0) {
    return 0;
  }

  return (
    reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  );
}

export function mapListingWithRating(
  listing: ListingWithRating,
  stats?: ListingRatingStats,
) {
  return {
    ...listing,
    reviewCount: stats?.reviewCount ?? 0,
    avgRating: stats?.avgRating ?? 0,
  };
}

export function mapToListingSearchDoc(
  listing: ListingWithAddress,
): ListingSearchDoc {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    title: listing.title,
    type: listing.type,
    price: listing.price,
    area: listing.area,
    description: listing.description,
    utilities: listing.utilities,
    images: listing.images,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    address: {
      street: listing.address.street,
      ward: listing.address.ward,
      district: listing.address.district,
      city: listing.address.city,
      province: listing.address.province,
      location: {
        lat: listing.address.lat,
        lon: listing.address.lng,
      },
    },
  };
}
