import { PrismaPg } from '@prisma/adapter-pg';
import {
  ListingStatus,
  ListingType,
  MessageType,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ReportReason,
  ReportStatus,
  Role,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const USER_1_ID = 'cmo2b8t4j0001hiskk227mr7r'; // Landlord
const USER_2_ID = 'cmo37llqa0000xkskwbyholl4'; // Tenant
const SEED_PASSWORD = 'congM456';

const PEXELS_SEARCH_TERMS = [
  'apartment interior',
  'studio apartment',
  'student room',
  'modern bedroom',
  'small bedroom',
  'serviced apartment',
  'living room apartment',
  'rental house interior',
  'dorm room',
  'minimal bedroom',
];

type PexelsPhoto = {
  src?: {
    large2x?: string;
    large?: string;
    medium?: string;
    original?: string;
  };
};

type PexelsResponse = {
  photos?: PexelsPhoto[];
};

type SeedListing = {
  title: string;
  type: ListingType;
  price: number;
  area: number;
  electricityFee?: number;
  waterFee?: number;
  description: string;
  utilities: string[];
  contactName: string;
  contactPhone: string;
  status: ListingStatus;
  address: {
    street: string;
    ward?: string;
    district: string;
    city: string;
    province: string;
    lat: number;
    lng: number;
  };
};

type FocusArea = {
  city: string;
  province: string;
  district: string;
  ward: string;
  streets: string[];
  lat: number;
  lng: number;
};

type FocusTemplate = {
  label: string;
  type: ListingType;
  minPrice: number;
  maxPrice: number;
  minArea: number;
  maxArea: number;
  utilities: string[];
  description: (area: FocusArea) => string;
};

async function fetchPexelsPhotos(): Promise<string[]> {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error(
      'PEXELS_API_KEY is missing. Add PEXELS_API_KEY=your_pexels_api_key_here to .env before running prisma db seed.',
    );
  }

  const urls = new Set<string>();

  for (const term of PEXELS_SEARCH_TERMS) {
    const params = new URLSearchParams({
      query: term,
      per_page: '8',
      orientation: 'landscape',
    });

    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Pexels request failed for "${term}" with status ${response.status}`,
      );
    }

    const data = (await response.json()) as PexelsResponse;

    for (const photo of data.photos ?? []) {
      const imageUrl =
        photo.src?.large2x ??
        photo.src?.large ??
        photo.src?.medium ??
        photo.src?.original;

      if (imageUrl) {
        urls.add(imageUrl);
      }
    }
  }

  return Array.from(urls);
}

function getFallbackImages(count = 80): string[] {
  return Array.from(
    { length: count },
    (_, index) =>
      `https://picsum.photos/seed/accommodation-vn-${index + 1}/1200/800`,
  );
}

async function getSeedImages(): Promise<string[]> {
  try {
    const images = await fetchPexelsPhotos();

    if (images.length > 0) {
      console.log(`🖼️  Fetched ${images.length} Pexels images`);
      return images;
    }

    console.warn('⚠️  Pexels returned no photos. Using Picsum fallbacks.');
    return getFallbackImages();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('PEXELS_API_KEY is missing')
    ) {
      throw error;
    }

    console.warn('⚠️  Could not fetch Pexels photos. Using Picsum fallbacks.');
    console.warn(error);
    return getFallbackImages();
  }
}

function getImagesForListing(images: string[], index: number): string[] {
  return [
    images[(index * 3) % images.length],
    images[(index * 3 + 1) % images.length],
    images[(index * 3 + 2) % images.length],
  ];
}

function interpolate(index: number, min: number, max: number): number {
  if (min === max) {
    return min;
  }

  return min + ((index * 7919) % (max - min + 1));
}

function buildFocusedListings(): SeedListing[] {
  const areas: FocusArea[] = [
    {
      city: 'Hà Nội',
      province: 'Hà Nội',
      district: 'Đống Đa',
      ward: 'Láng Thượng',
      streets: ['Chùa Láng', 'Nguyễn Chí Thanh', 'Pháo Đài Láng'],
      lat: 21.0231,
      lng: 105.8054,
    },
    {
      city: 'Hà Nội',
      province: 'Hà Nội',
      district: 'Cầu Giấy',
      ward: 'Dịch Vọng Hậu',
      streets: ['Xuân Thủy', 'Trần Thái Tông', 'Duy Tân'],
      lat: 21.0362,
      lng: 105.7829,
    },
    {
      city: 'Hà Nội',
      province: 'Hà Nội',
      district: 'Nam Từ Liêm',
      ward: 'Mỹ Đình 1',
      streets: ['Mễ Trì', 'Đình Thôn', 'Lê Đức Thọ'],
      lat: 21.0204,
      lng: 105.7716,
    },
    {
      city: 'Hà Nội',
      province: 'Hà Nội',
      district: 'Thanh Xuân',
      ward: 'Nhân Chính',
      streets: ['Nguyễn Trãi', 'Quan Nhân', 'Vũ Trọng Phụng'],
      lat: 20.9999,
      lng: 105.8077,
    },
    {
      city: 'Hà Nội',
      province: 'Hà Nội',
      district: 'Hoàng Mai',
      ward: 'Định Công',
      streets: ['Giải Phóng', 'Định Công', 'Kim Đồng'],
      lat: 20.9805,
      lng: 105.8412,
    },
    {
      city: 'Hà Nội',
      province: 'Hà Nội',
      district: 'Long Biên',
      ward: 'Ngọc Lâm',
      streets: ['Nguyễn Văn Cừ', 'Ngọc Lâm', 'Ái Mộ'],
      lat: 21.0446,
      lng: 105.8702,
    },
    {
      city: 'TP. Hồ Chí Minh',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Bến Thành',
      streets: ['Nguyễn Trãi', 'Cách Mạng Tháng 8', 'Lê Thánh Tôn'],
      lat: 10.7719,
      lng: 106.6978,
    },
    {
      city: 'TP. Hồ Chí Minh',
      province: 'TP. Hồ Chí Minh',
      district: 'Bình Thạnh',
      ward: 'Phường 25',
      streets: ['D2', 'Ung Văn Khiêm', 'Xô Viết Nghệ Tĩnh'],
      lat: 10.8047,
      lng: 106.7178,
    },
    {
      city: 'TP. Hồ Chí Minh',
      province: 'TP. Hồ Chí Minh',
      district: 'Thủ Đức',
      ward: 'Linh Trung',
      streets: ['Hoàng Diệu 2', 'Kha Vạn Cân', 'Lê Văn Chí'],
      lat: 10.8665,
      lng: 106.7818,
    },
    {
      city: 'TP. Hồ Chí Minh',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 7',
      ward: 'Tân Phú',
      streets: ['Nguyễn Lương Bằng', 'Nguyễn Thị Thập', 'Lâm Văn Bền'],
      lat: 10.7288,
      lng: 106.7217,
    },
    {
      city: 'TP. Hồ Chí Minh',
      province: 'TP. Hồ Chí Minh',
      district: 'Tân Bình',
      ward: 'Phường 2',
      streets: ['Bạch Đằng', 'Trường Sơn', 'Cộng Hòa'],
      lat: 10.8126,
      lng: 106.6645,
    },
    {
      city: 'TP. Hồ Chí Minh',
      province: 'TP. Hồ Chí Minh',
      district: 'Gò Vấp',
      ward: 'Phường 5',
      streets: ['Nguyễn Thái Sơn', 'Phan Văn Trị', 'Quang Trung'],
      lat: 10.8315,
      lng: 106.6683,
    },
    {
      city: 'Phủ Lý',
      province: 'Hà Nam',
      district: 'Phủ Lý',
      ward: 'Liêm Chính',
      streets: ['Biên Hòa', 'Lê Công Thanh', 'Trường Chinh'],
      lat: 20.5411,
      lng: 105.9139,
    },
    {
      city: 'Phủ Lý',
      province: 'Hà Nam',
      district: 'Phủ Lý',
      ward: 'Minh Khai',
      streets: ['Trần Hưng Đạo', 'Quy Lưu', 'Lê Hoàn'],
      lat: 20.5453,
      lng: 105.9176,
    },
    {
      city: 'Duy Tiên',
      province: 'Hà Nam',
      district: 'Duy Tiên',
      ward: 'Đồng Văn',
      streets: ['Quốc lộ 1A', 'Nguyễn Hữu Tiến', 'KCN Đồng Văn'],
      lat: 20.6285,
      lng: 105.9532,
    },
    {
      city: 'Kim Bảng',
      province: 'Hà Nam',
      district: 'Kim Bảng',
      ward: 'Quế',
      streets: ['ĐT 494', 'Nguyễn Khuyến', 'Ba Sao'],
      lat: 20.5721,
      lng: 105.8508,
    },
    {
      city: 'Lý Nhân',
      province: 'Hà Nam',
      district: 'Lý Nhân',
      ward: 'Vĩnh Trụ',
      streets: ['Trần Nhân Tông', 'ĐT 491', 'Nam Cao'],
      lat: 20.5659,
      lng: 106.0941,
    },
    {
      city: 'Thanh Liêm',
      province: 'Hà Nam',
      district: 'Thanh Liêm',
      ward: 'Kiện Khê',
      streets: ['Quốc lộ 1A', 'ĐT 495', 'Thanh Hà'],
      lat: 20.4596,
      lng: 105.8871,
    },
  ];

  const templates: FocusTemplate[] = [
    {
      label: 'Private Room',
      type: ListingType.ROOM,
      minPrice: 2200000,
      maxPrice: 5000000,
      minArea: 18,
      maxArea: 28,
      utilities: [
        'WiFi',
        'Private Bathroom',
        'Parking',
        'Security',
        'Desk',
        'Wardrobe',
      ],
      description: (area) =>
        `Private room in ${area.district}, ${area.province}, suitable for students and office workers. Close to local markets, food shops, and daily amenities.`,
    },
    {
      label: 'Mini Apartment',
      type: ListingType.APARTMENT,
      minPrice: 4500000,
      maxPrice: 9000000,
      minArea: 28,
      maxArea: 42,
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Private Bathroom',
        'Parking',
        'Refrigerator',
      ],
      description: (area) =>
        `Furnished mini apartment in ${area.district} with private kitchen corner and secure motorbike parking. Good for long-term tenants.`,
    },
    {
      label: 'Modern Studio',
      type: ListingType.STUDIO,
      minPrice: 5200000,
      maxPrice: 9800000,
      minArea: 25,
      maxArea: 38,
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Elevator',
        'Security',
        'Washing Machine',
      ],
      description: (area) =>
        `Modern studio in ${area.district}, fully furnished with good natural light. Convenient for young professionals and couples.`,
    },
    {
      label: 'Shared Room',
      type: ListingType.ROOM,
      minPrice: 1500000,
      maxPrice: 3300000,
      minArea: 16,
      maxArea: 24,
      utilities: [
        'WiFi',
        'Shared Kitchen',
        'Parking',
        'Security',
        'Near Bus Stop',
      ],
      description: (area) =>
        `Budget shared room in ${area.district}, ${area.province}. Practical option for students and workers looking for affordable monthly rent.`,
    },
    {
      label: 'Serviced Apartment',
      type: ListingType.APARTMENT,
      minPrice: 8500000,
      maxPrice: 18000000,
      minArea: 36,
      maxArea: 55,
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Private Bathroom',
        'Kitchen',
        'Elevator',
        'Security',
        'Washing Machine',
      ],
      description: (area) =>
        `Serviced apartment in ${area.district} with furniture, elevator, and regular building maintenance. Easy access to shops and main roads.`,
    },
    {
      label: 'House for Rent',
      type: ListingType.HOUSE,
      minPrice: 10000000,
      maxPrice: 32000000,
      minArea: 60,
      maxArea: 105,
      utilities: [
        'WiFi',
        'Kitchen',
        'Washing Machine',
        'Parking',
        'Balcony',
        'Pet Friendly',
      ],
      description: (area) =>
        `House for rent in a residential area of ${area.district}. Suitable for families or groups who need more living space and parking.`,
    },
  ];

  const focusedListings: SeedListing[] = [];
  const cityTargets = [
    { province: 'Hà Nội', count: 20 },
    { province: 'TP. Hồ Chí Minh', count: 20 },
    { province: 'Hà Nam', count: 20 },
  ];

  for (const target of cityTargets) {
    const targetAreas = areas.filter(
      (area) => area.province === target.province,
    );

    for (let index = 0; index < target.count; index++) {
      const area = targetAreas[index % targetAreas.length];
      const template = templates[index % templates.length];
      const street = area.streets[index % area.streets.length];
      const houseNo = 12 + index * 7;
      const price =
        Math.round(
          interpolate(index, template.minPrice, template.maxPrice) / 100000,
        ) * 100000;
      const areaSize = interpolate(index, template.minArea, template.maxArea);

      focusedListings.push({
        title: `${template.label} in ${area.district} ${target.province} #${index + 1}`,
        type: template.type,
        price,
        area: areaSize,
        electricityFee: 3500 + (index % 4) * 300,
        waterFee: 60000 + (index % 5) * 20000,
        description: template.description(area),
        utilities: template.utilities,
        contactName: 'Nguyễn Văn An',
        contactPhone: '0901234567',
        status: ListingStatus.ACTIVE,
        address: {
          street: `${houseNo} ${street}`,
          ward: area.ward,
          district: area.district,
          city: area.city,
          province: area.province,
          lat: Number((area.lat + (index % 5) * 0.002).toFixed(6)),
          lng: Number((area.lng + (index % 5) * 0.002).toFixed(6)),
        },
      });
    }
  }

  return focusedListings;
}

async function createMockHostIfNeeded(hashedPassword: string) {
  return prisma.user.upsert({
    where: { email: 'landlord@accomfinder.vn' },
    update: {
      phone: '0901234567',
      name: 'Nguyễn Văn An',
      avatarUrl: 'https://i.pravatar.cc/150?u=landlord',
      password: hashedPassword,
      role: Role.LANDLORD,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
    },
    create: {
      id: USER_1_ID,
      email: 'landlord@accomfinder.vn',
      phone: '0901234567',
      name: 'Nguyễn Văn An',
      avatarUrl: 'https://i.pravatar.cc/150?u=landlord',
      password: hashedPassword,
      role: Role.LANDLORD,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
    },
  });
}

async function seedAccommodations(ownerId: string, images: string[]) {
  const listings: SeedListing[] = [
    {
      title: 'Modern Studio Apartment in Cầu Giấy',
      type: ListingType.STUDIO,
      price: 7200000,
      area: 32,
      electricityFee: 4000,
      waterFee: 100000,
      description:
        'Fully furnished studio apartment in Cầu Giấy, suitable for students and young professionals. Close to universities, convenience stores, and bus stops.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Private Bathroom',
        'Kitchen',
        'Desk',
        'Wardrobe',
        'Near University',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '102 Cầu Giấy',
        ward: 'Dịch Vọng',
        district: 'Cầu Giấy',
        city: 'Hà Nội',
        province: 'Hà Nội',
        lat: 21.0333,
        lng: 105.7968,
      },
    },
    {
      title: 'Affordable Student Room near Bách Khoa University',
      type: ListingType.ROOM,
      price: 3200000,
      area: 20,
      electricityFee: 4000,
      waterFee: 70000,
      description:
        'Clean private room near Bách Khoa, Kinh tế Quốc dân, and Xây dựng universities. Good for students who need a quiet place to study.',
      utilities: [
        'WiFi',
        'Private Bathroom',
        'Shared Kitchen',
        'Parking',
        'Security',
        'Near University',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '38 Trần Đại Nghĩa',
        ward: 'Bách Khoa',
        district: 'Hai Bà Trưng',
        city: 'Hà Nội',
        province: 'Hà Nội',
        lat: 21.0055,
        lng: 105.8442,
      },
    },
    {
      title: 'Mini Apartment near Mỹ Đình',
      type: ListingType.APARTMENT,
      price: 6500000,
      area: 35,
      electricityFee: 3800,
      waterFee: 90000,
      description:
        'Bright mini apartment near Mỹ Đình bus station and office buildings. Comes with basic furniture, kitchen area, and secure parking.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Washing Machine',
        'Parking',
        'Elevator',
        'Security',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '26 Hàm Nghi',
        ward: 'Mỹ Đình 2',
        district: 'Nam Từ Liêm',
        city: 'Hà Nội',
        province: 'Hà Nội',
        lat: 21.0307,
        lng: 105.7733,
      },
    },
    {
      title: 'Serviced Apartment in District 1',
      type: ListingType.APARTMENT,
      price: 15500000,
      area: 48,
      electricityFee: 4500,
      waterFee: 150000,
      description:
        'Serviced apartment in the center of District 1 with weekly cleaning, elevator, and 24/7 security. Easy access to cafés, offices, and shopping.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Private Bathroom',
        'Kitchen',
        'Washing Machine',
        'Elevator',
        'Security',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '12 Lý Tự Trọng',
        ward: 'Bến Nghé',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        province: 'TP. Hồ Chí Minh',
        lat: 10.7769,
        lng: 106.7009,
      },
    },
    {
      title: 'House for Rent in Bình Thạnh',
      type: ListingType.HOUSE,
      price: 22000000,
      area: 86,
      electricityFee: 4200,
      waterFee: 180000,
      description:
        'Two-floor house in a quiet alley in Bình Thạnh. Suitable for a family or a small group of working professionals.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Washing Machine',
        'Parking',
        'Balcony',
        'Pet Friendly',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '88 Điện Biên Phủ',
        ward: 'Phường 15',
        district: 'Bình Thạnh',
        city: 'TP. Hồ Chí Minh',
        province: 'TP. Hồ Chí Minh',
        lat: 10.801,
        lng: 106.7143,
      },
    },
    {
      title: 'Motel Room in Thủ Đức',
      type: ListingType.ROOM,
      price: 3800000,
      area: 24,
      electricityFee: 4000,
      waterFee: 80000,
      description:
        'Affordable phòng trọ in Thủ Đức with private bathroom and parking. Convenient for students and workers around the university village.',
      utilities: [
        'WiFi',
        'Private Bathroom',
        'Parking',
        'Security',
        'Near Bus Stop',
        'Near University',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '54 Võ Văn Ngân',
        ward: 'Linh Chiểu',
        district: 'Thủ Đức',
        city: 'TP. Hồ Chí Minh',
        province: 'TP. Hồ Chí Minh',
        lat: 10.8498,
        lng: 106.7717,
      },
    },
    {
      title: 'Private Room in Đà Nẵng City Center',
      type: ListingType.ROOM,
      price: 4200000,
      area: 23,
      electricityFee: 3800,
      waterFee: 70000,
      description:
        'Private room in Hải Châu, close to the Hàn River and city center. Fully furnished and suitable for long-term tenants.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Private Bathroom',
        'Parking',
        'Security',
        'Near Bus Stop',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '30 Trần Phú',
        ward: 'Thạch Thang',
        district: 'Hải Châu',
        city: 'Đà Nẵng',
        province: 'Đà Nẵng',
        lat: 16.0678,
        lng: 108.2208,
      },
    },
    {
      title: 'Beachside Studio in Sơn Trà',
      type: ListingType.STUDIO,
      price: 7800000,
      area: 34,
      electricityFee: 4000,
      waterFee: 100000,
      description:
        'Comfortable studio near Mỹ Khê beach with balcony, kitchenette, and elevator. Good for remote workers or couples.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Elevator',
        'Balcony',
        'Security',
        'Refrigerator',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '18 Võ Nguyên Giáp',
        ward: 'Phước Mỹ',
        district: 'Sơn Trà',
        city: 'Đà Nẵng',
        province: 'Đà Nẵng',
        lat: 16.0642,
        lng: 108.2468,
      },
    },
    {
      title: 'Serviced Apartment near Lạch Tray',
      type: ListingType.APARTMENT,
      price: 8500000,
      area: 42,
      electricityFee: 3900,
      waterFee: 100000,
      description:
        'Serviced apartment in Ngô Quyền, Hải Phòng. Furnished room with elevator, security, and easy access to local restaurants.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Private Bathroom',
        'Kitchen',
        'Elevator',
        'Security',
        'Washing Machine',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '72 Lạch Tray',
        ward: 'Lạch Tray',
        district: 'Ngô Quyền',
        city: 'Hải Phòng',
        province: 'Hải Phòng',
        lat: 20.8467,
        lng: 106.6881,
      },
    },
    {
      title: 'Private Room near Ninh Kiều Wharf',
      type: ListingType.ROOM,
      price: 3500000,
      area: 22,
      electricityFee: 3500,
      waterFee: 70000,
      description:
        'Neat private room in Ninh Kiều, close to the riverfront, market, and public transport. Suitable for students or office workers.',
      utilities: [
        'WiFi',
        'Private Bathroom',
        'Shared Kitchen',
        'Parking',
        'Security',
        'Near Bus Stop',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '9 Hai Bà Trưng',
        ward: 'Tân An',
        district: 'Ninh Kiều',
        city: 'Cần Thơ',
        province: 'Cần Thơ',
        lat: 10.0338,
        lng: 105.7837,
      },
    },
    {
      title: 'Mini Apartment near Huế Citadel',
      type: ListingType.APARTMENT,
      price: 5200000,
      area: 30,
      electricityFee: 3500,
      waterFee: 80000,
      description:
        'Mini apartment in central Huế with simple furniture, quiet neighborhood, and quick access to schools and cafés.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Private Bathroom',
        'Parking',
        'Wardrobe',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '21 Lê Lợi',
        ward: 'Phú Hội',
        district: 'Thành phố Huế',
        city: 'Huế',
        province: 'Thừa Thiên Huế',
        lat: 16.4637,
        lng: 107.5909,
      },
    },
    {
      title: 'Apartment near Nha Trang Beach',
      type: ListingType.APARTMENT,
      price: 9000000,
      area: 46,
      electricityFee: 4000,
      waterFee: 120000,
      description:
        'Furnished apartment near Trần Phú beach, suitable for tenants who want a central location and comfortable living space.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Balcony',
        'Elevator',
        'Security',
        'Refrigerator',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '64 Trần Phú',
        ward: 'Lộc Thọ',
        district: 'Nha Trang',
        city: 'Nha Trang',
        province: 'Khánh Hòa',
        lat: 12.2388,
        lng: 109.1967,
      },
    },
    {
      title: 'Homestay near Đà Lạt Night Market',
      type: ListingType.ROOM,
      price: 4800000,
      area: 26,
      electricityFee: 3500,
      waterFee: 80000,
      description:
        'Cozy homestay-style private room near Đà Lạt night market. Bright interior, shared kitchen, and friendly host.',
      utilities: [
        'WiFi',
        'Shared Kitchen',
        'Private Bathroom',
        'Desk',
        'Wardrobe',
        'Near Bus Stop',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '15 Nguyễn Chí Thanh',
        ward: 'Phường 1',
        district: 'Đà Lạt',
        city: 'Đà Lạt',
        province: 'Lâm Đồng',
        lat: 11.9404,
        lng: 108.4583,
      },
    },
    {
      title: 'Shared Room near Dĩ An University Area',
      type: ListingType.ROOM,
      price: 2300000,
      area: 18,
      electricityFee: 3500,
      waterFee: 60000,
      description:
        'Budget shared room in Dĩ An, Bình Dương. Good choice for students and workers looking for low monthly rent.',
      utilities: [
        'WiFi',
        'Shared Kitchen',
        'Parking',
        'Security',
        'Near University',
        'Near Bus Stop',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '7 Nguyễn An Ninh',
        ward: 'Dĩ An',
        district: 'Dĩ An',
        city: 'Dĩ An',
        province: 'Bình Dương',
        lat: 10.9068,
        lng: 106.7694,
      },
    },
    {
      title: 'Studio Apartment in Biên Hòa',
      type: ListingType.STUDIO,
      price: 5600000,
      area: 31,
      electricityFee: 3600,
      waterFee: 80000,
      description:
        'New studio apartment in Biên Hòa with private kitchen corner, air conditioning, and secure motorbike parking.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Private Bathroom',
        'Parking',
        'Security',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '42 Phạm Văn Thuận',
        ward: 'Tân Mai',
        district: 'Biên Hòa',
        city: 'Biên Hòa',
        province: 'Đồng Nai',
        lat: 10.9574,
        lng: 106.8426,
      },
    },
    {
      title: 'Apartment near Hạ Long Marina',
      type: ListingType.APARTMENT,
      price: 8200000,
      area: 44,
      electricityFee: 4000,
      waterFee: 100000,
      description:
        'Modern apartment in Hạ Long with elevator and balcony. Convenient for long-term tenants working around Bãi Cháy.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Elevator',
        'Balcony',
        'Security',
        'Parking',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '3 Hạ Long',
        ward: 'Bãi Cháy',
        district: 'Hạ Long',
        city: 'Hạ Long',
        province: 'Quảng Ninh',
        lat: 20.9597,
        lng: 107.0448,
      },
    },
    {
      title: 'Serviced Room in Vũng Tàu',
      type: ListingType.ROOM,
      price: 5000000,
      area: 25,
      electricityFee: 3800,
      waterFee: 90000,
      description:
        'Serviced room near Vũng Tàu Back Beach. Furnished, clean, and suitable for workers or long-stay guests.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Private Bathroom',
        'Washing Machine',
        'Parking',
        'Security',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '128 Thùy Vân',
        ward: 'Phường 2',
        district: 'Vũng Tàu',
        city: 'Vũng Tàu',
        province: 'Bà Rịa - Vũng Tàu',
        lat: 10.3363,
        lng: 107.0871,
      },
    },
    {
      title: 'Private Room near Vinh University',
      type: ListingType.ROOM,
      price: 2800000,
      area: 20,
      electricityFee: 3500,
      waterFee: 60000,
      description:
        'Affordable private room near Vinh University. Quiet residential area with WiFi, parking, and easy access to food shops.',
      utilities: [
        'WiFi',
        'Private Bathroom',
        'Parking',
        'Security',
        'Near University',
        'Desk',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '182 Lê Duẩn',
        ward: 'Trường Thi',
        district: 'Vinh',
        city: 'Vinh',
        province: 'Nghệ An',
        lat: 18.6796,
        lng: 105.6813,
      },
    },
    {
      title: 'Student Dormitory in Thanh Hóa City',
      type: ListingType.ROOM,
      price: 1900000,
      area: 16,
      electricityFee: 3500,
      waterFee: 50000,
      description:
        'Simple student dormitory room in Thanh Hóa City. Shared kitchen, secure entrance, and low monthly cost.',
      utilities: [
        'WiFi',
        'Shared Kitchen',
        'Parking',
        'Security',
        'Near Bus Stop',
        'Desk',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '55 Đại lộ Lê Lợi',
        ward: 'Lam Sơn',
        district: 'Thanh Hóa',
        city: 'Thanh Hóa',
        province: 'Thanh Hóa',
        lat: 19.8067,
        lng: 105.7852,
      },
    },
    {
      title: 'Mini Apartment in Quy Nhơn Center',
      type: ListingType.APARTMENT,
      price: 6100000,
      area: 33,
      electricityFee: 3600,
      waterFee: 80000,
      description:
        'Compact mini apartment in central Quy Nhơn with kitchenette and private bathroom. Close to shops and the beach road.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Private Bathroom',
        'Refrigerator',
        'Parking',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '24 Nguyễn Tất Thành',
        ward: 'Lê Lợi',
        district: 'Quy Nhơn',
        city: 'Quy Nhơn',
        province: 'Bình Định',
        lat: 13.782,
        lng: 109.219,
      },
    },
    {
      title: 'House for Rent in Buôn Ma Thuột',
      type: ListingType.HOUSE,
      price: 12000000,
      area: 72,
      electricityFee: 3500,
      waterFee: 100000,
      description:
        'One-story house in Buôn Ma Thuột with two bedrooms, kitchen, front yard parking, and a calm residential neighborhood.',
      utilities: [
        'WiFi',
        'Air Conditioning',
        'Kitchen',
        'Washing Machine',
        'Parking',
        'Pet Friendly',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      address: {
        street: '68 Phan Chu Trinh',
        ward: 'Thắng Lợi',
        district: 'Buôn Ma Thuột',
        city: 'Buôn Ma Thuột',
        province: 'Đắk Lắk',
        lat: 12.6662,
        lng: 108.0382,
      },
    },
  ];

  listings.push(...buildFocusedListings());

  const createdListings = [];

  for (let index = 0; index < listings.length; index++) {
    const listing = listings[index];
    const { address, ...listingData } = listing;
    const existingListing = await prisma.listing.findFirst({
      where: {
        ownerId,
        title: listing.title,
      },
    });

    if (existingListing) {
      createdListings.push(existingListing);
      continue;
    }

    const createdAddress = await prisma.address.create({
      data: address,
    });

    const createdListing = await prisma.listing.create({
      data: {
        ...listingData,
        ownerId,
        addressId: createdAddress.id,
        images: getImagesForListing(images, index),
        expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    createdListings.push(createdListing);
  }

  return createdListings;
}

async function main() {
  console.log('🌱 Seeding database...');

  const pexelsImages = await getSeedImages();
  console.log('🧩 Running additive seed; existing data will not be cleared.');

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  const landlord = await createMockHostIfNeeded(hashedPassword);

  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@accomfinder.vn' },
    update: {
      phone: '0912345678',
      name: 'Trần Thị Bình',
      avatarUrl: 'https://i.pravatar.cc/150?u=tenant',
      password: hashedPassword,
      role: Role.TENANT,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: false,
    },
    create: {
      id: USER_2_ID,
      email: 'tenant@accomfinder.vn',
      phone: '0912345678',
      name: 'Trần Thị Bình',
      avatarUrl: 'https://i.pravatar.cc/150?u=tenant',
      password: hashedPassword,
      role: Role.TENANT,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: false,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@accomfinder.vn' },
    update: {
      name: 'Admin System',
      password: hashedPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
    create: {
      email: 'admin@accomfinder.vn',
      name: 'Admin System',
      password: hashedPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  });

  console.log(
    `👤 Created users: ${landlord.name}, ${tenant.name}, ${admin.name}`,
  );

  await prisma.userSession.createMany({
    data: [
      {
        userId: USER_1_ID,
        token: 'session-token-landlord-abc123',
        deviceInfo: 'Chrome/Windows',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: USER_2_ID,
        token: 'session-token-tenant-xyz456',
        deviceInfo: 'Safari/iPhone',
        ipAddress: '192.168.1.2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  const basicPlan = await prisma.plan.upsert({
    where: { name: 'Cơ Bản' },
    update: {
      priceVnd: 99000,
      maxListings: 3,
      durationDays: 30,
      featured: false,
      isActive: true,
    },
    create: {
      name: 'Cơ Bản',
      priceVnd: 99000,
      maxListings: 3,
      durationDays: 30,
      featured: false,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { name: 'Chuyên Nghiệp' },
    update: {
      priceVnd: 299000,
      maxListings: 10,
      durationDays: 30,
      featured: true,
      isActive: true,
    },
    create: {
      name: 'Chuyên Nghiệp',
      priceVnd: 299000,
      maxListings: 10,
      durationDays: 30,
      featured: true,
      isActive: true,
    },
  });

  const premiumPlan = await prisma.plan.upsert({
    where: { name: 'Cao Cấp' },
    update: {
      priceVnd: 599000,
      maxListings: 999,
      durationDays: 30,
      featured: true,
      isActive: true,
    },
    create: {
      name: 'Cao Cấp',
      priceVnd: 599000,
      maxListings: 999,
      durationDays: 30,
      featured: true,
      isActive: true,
    },
  });

  console.log(
    `📦 Created plans: ${basicPlan.name}, ${proPlan.name}, ${premiumPlan.name}`,
  );

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId: USER_1_ID,
      planId: proPlan.id,
      status: SubscriptionStatus.ACTIVE,
    },
  });

  const subscription = existingSubscription
    ? await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          startAt: new Date(),
          endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    : await prisma.subscription.create({
        data: {
          userId: USER_1_ID,
          planId: proPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startAt: new Date(),
          endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

  await prisma.payment.upsert({
    where: { txnRef: 'VNPAY-20240101-001' },
    update: {
      userId: USER_1_ID,
      subscriptionId: subscription.id,
      amount: proPlan.priceVnd,
      method: PaymentMethod.VNPAY,
      status: PaymentStatus.SUCCESS,
      paidAt: new Date(),
    },
    create: {
      userId: USER_1_ID,
      subscriptionId: subscription.id,
      amount: proPlan.priceVnd,
      method: PaymentMethod.VNPAY,
      status: PaymentStatus.SUCCESS,
      txnRef: 'VNPAY-20240101-001',
      paidAt: new Date(),
    },
  });

  const listings = await seedAccommodations(USER_1_ID, pexelsImages);
  console.log(
    `🏠 Upserted ${listings.length} Vietnamese accommodation listings`,
  );

  const existingHistoryCount = await prisma.listingHistory.count({
    where: {
      listingId: {
        in: [listings[0].id, listings[1].id],
      },
    },
  });

  if (existingHistoryCount === 0) {
    await prisma.listingHistory.createMany({
      data: [
        {
          listingId: listings[0].id,
          changedBy: USER_1_ID,
          oldStatus: null,
          newStatus: ListingStatus.DRAFT,
          note: 'Tạo mới',
        },
        {
          listingId: listings[0].id,
          changedBy: USER_1_ID,
          oldStatus: ListingStatus.DRAFT,
          newStatus: ListingStatus.PENDING,
          note: 'Gửi duyệt',
        },
        {
          listingId: listings[0].id,
          changedBy: admin.id,
          oldStatus: ListingStatus.PENDING,
          newStatus: ListingStatus.ACTIVE,
          note: 'Đã duyệt',
        },
        {
          listingId: listings[1].id,
          changedBy: USER_1_ID,
          oldStatus: null,
          newStatus: ListingStatus.DRAFT,
        },
        {
          listingId: listings[1].id,
          changedBy: admin.id,
          oldStatus: ListingStatus.DRAFT,
          newStatus: ListingStatus.ACTIVE,
        },
      ],
    });
  }

  const existingViewCount = await prisma.listingView.count({
    where: {
      listingId: {
        in: [listings[0].id, listings[1].id, listings[2].id],
      },
    },
  });

  if (existingViewCount === 0) {
    const viewData = [];
    for (let i = 0; i < 3; i++) {
      viewData.push({
        listingId: listings[0].id,
        userId: USER_2_ID,
        ipAddress: '192.168.1.2',
      });
      viewData.push({
        listingId: listings[1].id,
        userId: USER_2_ID,
        ipAddress: '192.168.1.2',
      });
      viewData.push({
        listingId: listings[0].id,
        userId: null,
        ipAddress: `10.0.0.${i + 1}`,
      });
      viewData.push({
        listingId: listings[2].id,
        userId: null,
        ipAddress: `10.0.1.${i + 1}`,
      });
    }
    await prisma.listingView.createMany({ data: viewData });
  }

  await prisma.listing.update({
    where: { id: listings[0].id },
    data: { viewCount: 6 },
  });
  await prisma.listing.update({
    where: { id: listings[1].id },
    data: { viewCount: 3 },
  });
  await prisma.listing.update({
    where: { id: listings[2].id },
    data: { viewCount: 3 },
  });

  await prisma.savedListing.createMany({
    data: [
      { userId: USER_2_ID, listingId: listings[0].id },
      { userId: USER_2_ID, listingId: listings[3].id },
      { userId: USER_2_ID, listingId: listings[12].id },
    ],
    skipDuplicates: true,
  });

  const review1 = await prisma.review.upsert({
    where: {
      listingId_userId: {
        listingId: listings[0].id,
        userId: USER_2_ID,
      },
    },
    update: {
      rating: 5,
      comment:
        'Phòng rất sạch sẽ, chủ nhà thân thiện. Vị trí đẹp, gần nhiều tiện ích.',
      isVerified: true,
    },
    create: {
      listingId: listings[0].id,
      userId: USER_2_ID,
      rating: 5,
      comment:
        'Phòng rất sạch sẽ, chủ nhà thân thiện. Vị trí đẹp, gần nhiều tiện ích.',
      isVerified: true,
    },
  });

  const review2 = await prisma.review.upsert({
    where: {
      listingId_userId: {
        listingId: listings[3].id,
        userId: USER_2_ID,
      },
    },
    update: {
      rating: 4,
      comment:
        'Căn hộ đẹp, đầy đủ nội thất. Giá hơi cao nhưng vị trí trung tâm rất tiện.',
      isVerified: false,
    },
    create: {
      listingId: listings[3].id,
      userId: USER_2_ID,
      rating: 4,
      comment:
        'Căn hộ đẹp, đầy đủ nội thất. Giá hơi cao nhưng vị trí trung tâm rất tiện.',
      isVerified: false,
    },
  });

  const existingReply = await prisma.reviewReply.findFirst({
    where: {
      reviewId: review1.id,
      userId: USER_1_ID,
    },
  });

  if (!existingReply) {
    await prisma.reviewReply.create({
      data: {
        reviewId: review1.id,
        userId: USER_1_ID,
        content:
          'Cảm ơn bạn đã để lại đánh giá tích cực! Rất vui được hỗ trợ bạn.',
      },
    });
  }

  const existingListingReport = await prisma.report.findFirst({
    where: {
      reporterId: USER_2_ID,
      listingId: listings[5].id,
      reason: ReportReason.WRONG_INFO,
    },
  });

  if (!existingListingReport) {
    await prisma.report.create({
      data: {
        reporterId: USER_2_ID,
        listingId: listings[5].id,
        reason: ReportReason.WRONG_INFO,
        detail: 'Giá phòng trong tin đăng khác với giá thực tế khi liên hệ.',
        status: ReportStatus.PENDING,
      },
    });
  }

  const existingReviewReport = await prisma.report.findFirst({
    where: {
      reporterId: USER_2_ID,
      reviewId: review2.id,
      reason: ReportReason.INAPPROPRIATE,
    },
  });

  if (!existingReviewReport) {
    await prisma.report.create({
      data: {
        reporterId: USER_2_ID,
        reviewId: review2.id,
        reason: ReportReason.INAPPROPRIATE,
        detail: 'Nội dung đánh giá không phù hợp.',
        status: ReportStatus.REVIEWED,
        resolvedBy: admin.id,
      },
    });
  }

  const notificationData = [
    {
      userId: USER_1_ID,
      type: NotificationType.LISTING_APPROVED,
      title: 'Tin đăng đã được duyệt',
      body: `Tin đăng "${listings[0].title}" đã được phê duyệt và đang hiển thị.`,
      refId: listings[0].id,
      isRead: true,
    },
    {
      userId: USER_1_ID,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Thanh toán thành công',
      body: 'Gói Chuyên Nghiệp đã được kích hoạt thành công.',
      refId: subscription.id,
      isRead: false,
    },
    {
      userId: USER_1_ID,
      type: NotificationType.NEW_REVIEW,
      title: 'Đánh giá mới',
      body: `${tenant.name} đã đánh giá 5 sao cho tin đăng của bạn.`,
      refId: review1.id,
      isRead: false,
    },
    {
      userId: USER_2_ID,
      type: NotificationType.NEW_MESSAGE,
      title: 'Tin nhắn mới',
      body: `${landlord.name} đã gửi tin nhắn cho bạn.`,
      refId: listings[0].id,
      isRead: false,
    },
    {
      userId: USER_1_ID,
      type: NotificationType.SUBSCRIPTION_EXPIRING,
      title: 'Gói dịch vụ sắp hết hạn',
      body: 'Gói Chuyên Nghiệp của bạn sẽ hết hạn sau 7 ngày. Hãy gia hạn để tiếp tục sử dụng.',
      isRead: false,
    },
  ];

  for (const notification of notificationData) {
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: notification.userId,
        type: notification.type,
        refId: notification.refId,
      },
    });

    if (!existingNotification) {
      await prisma.notification.create({ data: notification });
    }
  }

  const existingChat = await prisma.chat.findFirst({
    where: {
      user1Id: USER_1_ID,
      user2Id: USER_2_ID,
      listingId: listings[0].id,
    },
  });

  const chat =
    existingChat ??
    (await prisma.chat.create({
      data: {
        user1Id: USER_1_ID,
        user2Id: USER_2_ID,
        listingId: listings[0].id,
      },
    }));

  const messageData = [
    {
      senderId: USER_2_ID,
      content: 'Xin chào, phòng này còn trống không anh/chị?',
      type: MessageType.TEXT,
      isRead: true,
    },
    {
      senderId: USER_1_ID,
      content: 'Chào bạn! Phòng vẫn còn trống nhé. Bạn muốn xem phòng khi nào?',
      type: MessageType.TEXT,
      isRead: true,
    },
    {
      senderId: USER_2_ID,
      content: 'Cho mình xem phòng vào chiều thứ 7 này được không ạ?',
      type: MessageType.TEXT,
      isRead: true,
    },
    {
      senderId: USER_1_ID,
      content:
        'Được bạn ơi! Khoảng 2-5 giờ chiều thứ 7 đều ok. Bạn đến giờ nào?',
      type: MessageType.TEXT,
      isRead: true,
    },
    {
      senderId: USER_2_ID,
      content: 'Mình sẽ đến lúc 3 giờ chiều nhé anh/chị.',
      type: MessageType.TEXT,
      isRead: true,
    },
    {
      senderId: USER_1_ID,
      content: `Ok bạn nhé! Mình sẽ đợi bạn tại ${listings[0].title}.`,
      type: MessageType.TEXT,
      isRead: false,
    },
  ];

  const existingMessageCount = await prisma.message.count({
    where: { chatId: chat.id },
  });

  if (existingMessageCount === 0) {
    for (const msg of messageData) {
      await prisma.message.create({
        data: { chatId: chat.id, ...msg },
      });
    }
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('─'.repeat(50));
  console.log(
    `👤 Landlord  | ID: ${USER_1_ID} | email: landlord@accomfinder.vn`,
  );
  console.log(`👤 Tenant    | ID: ${USER_2_ID} | email: tenant@accomfinder.vn`);
  console.log(`👤 Admin     | ID: ${admin.id}   | email: admin@accomfinder.vn`);
  console.log(`🏠 Listings  | ${listings.length}`);
  console.log(`🔑 Password  | ${SEED_PASSWORD} (all users)`);
  console.log('─'.repeat(50));
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
