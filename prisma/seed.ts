import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Role,
  UserStatus,
  ListingType,
  ListingStatus,
  ReportReason,
  ReportStatus,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
  MessageType,
  NotificationType,
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

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Clean up ──────────────────────────────────────────────────────────────
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.report.deleteMany();
  await prisma.reviewReply.deleteMany();
  await prisma.review.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.listingView.deleteMany();
  await prisma.listingHistory.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.address.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleaned existing data');

  // ─── Users ─────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 10);

  const landlord = await prisma.user.create({
    data: {
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

  const tenant = await prisma.user.create({
    data: {
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

  const admin = await prisma.user.create({
    data: {
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

  // ─── User Sessions ──────────────────────────────────────────────────────────
  await prisma.userSession.create({
    data: {
      userId: USER_1_ID,
      token: 'session-token-landlord-abc123',
      deviceInfo: 'Chrome/Windows',
      ipAddress: '192.168.1.1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.userSession.create({
    data: {
      userId: USER_2_ID,
      token: 'session-token-tenant-xyz456',
      deviceInfo: 'Safari/iPhone',
      ipAddress: '192.168.1.2',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('🔑 Created user sessions');

  // ─── Addresses ─────────────────────────────────────────────────────────────
  const addresses = await prisma.address.createManyAndReturn({
    data: [
      // Ho Chi Minh City
      {
        street: '12 Lý Tự Trọng',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'Hồ Chí Minh',
        province: 'Hồ Chí Minh',
        lat: 10.7769,
        lng: 106.7009,
      },
      {
        street: '45 Nguyễn Trãi',
        ward: 'Phường Nguyễn Cư Trinh',
        district: 'Quận 1',
        city: 'Hồ Chí Minh',
        province: 'Hồ Chí Minh',
        lat: 10.7665,
        lng: 106.69,
      },
      {
        street: '88 Điện Biên Phủ',
        ward: 'Phường 15',
        district: 'Quận Bình Thạnh',
        city: 'Hồ Chí Minh',
        province: 'Hồ Chí Minh',
        lat: 10.801,
        lng: 106.7143,
      },
      {
        street: '23 Võ Văn Tần',
        ward: 'Phường 6',
        district: 'Quận 3',
        city: 'Hồ Chí Minh',
        province: 'Hồ Chí Minh',
        lat: 10.7752,
        lng: 106.6894,
      },
      // Ha Noi
      {
        street: '5 Hàng Bông',
        ward: 'Phường Hàng Bông',
        district: 'Quận Hoàn Kiếm',
        city: 'Hà Nội',
        province: 'Hà Nội',
        lat: 21.0285,
        lng: 105.8542,
      },
      {
        street: '102 Cầu Giấy',
        ward: 'Phường Dịch Vọng',
        district: 'Quận Cầu Giấy',
        city: 'Hà Nội',
        province: 'Hà Nội',
        lat: 21.0333,
        lng: 105.7968,
      },
      // Da Nang
      {
        street: '30 Trần Phú',
        ward: 'Phường Thạch Thang',
        district: 'Quận Hải Châu',
        city: 'Đà Nẵng',
        province: 'Đà Nẵng',
        lat: 16.0678,
        lng: 108.2208,
      },
    ],
  });

  console.log(`📍 Created ${addresses.length} addresses`);

  // ─── Plans ──────────────────────────────────────────────────────────────────
  const basicPlan = await prisma.plan.create({
    data: {
      name: 'Cơ Bản',
      priceVnd: 99000,
      maxListings: 3,
      durationDays: 30,
      featured: false,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Chuyên Nghiệp',
      priceVnd: 299000,
      maxListings: 10,
      durationDays: 30,
      featured: true,
      isActive: true,
    },
  });

  const premiumPlan = await prisma.plan.create({
    data: {
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

  // ─── Subscription & Payment (Landlord) ────────────────────────────────────
  const subscription = await prisma.subscription.create({
    data: {
      userId: USER_1_ID,
      planId: proPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.payment.create({
    data: {
      userId: USER_1_ID,
      subscriptionId: subscription.id,
      amount: proPlan.priceVnd,
      method: PaymentMethod.VNPAY,
      status: PaymentStatus.SUCCESS,
      txnRef: 'VNPAY-20240101-001',
      paidAt: new Date(),
    },
  });

  console.log('💳 Created subscription & payment');

  // ─── Listings ───────────────────────────────────────────────────────────────
  const listingData = [
    {
      addressId: addresses[0].id,
      title: 'Phòng trọ cao cấp trung tâm Quận 1',
      type: ListingType.ROOM,
      price: 4500000,
      area: 25,
      electricityFee: 3500,
      waterFee: 80000,
      description:
        'Phòng trọ sạch sẽ, thoáng mát, đầy đủ nội thất. Gần chợ Bến Thành, tiện di chuyển.',
      utilities: ['wifi', 'ac', 'parking', 'security', 'elevator'],
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      addressId: addresses[1].id,
      title: 'Căn hộ mini hiện đại Quận 1',
      type: ListingType.APARTMENT,
      price: 7500000,
      area: 40,
      electricityFee: 3500,
      waterFee: 100000,
      description:
        'Căn hộ mini mới xây, thiết kế hiện đại. Full nội thất cao cấp.',
      utilities: ['wifi', 'ac', 'washer', 'kitchen', 'security'],
      images: [
        'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      addressId: addresses[2].id,
      title: 'Studio view đẹp Bình Thạnh',
      type: ListingType.STUDIO,
      price: 6000000,
      area: 35,
      electricityFee: 3500,
      waterFee: 80000,
      description:
        'Studio mới, view đẹp nhìn ra sông Sài Gòn. Gần cầu Sài Gòn.',
      utilities: ['wifi', 'ac', 'balcony', 'security'],
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      addressId: addresses[3].id,
      title: 'Nhà nguyên căn Quận 3 yên tĩnh',
      type: ListingType.HOUSE,
      price: 15000000,
      area: 80,
      electricityFee: 3500,
      waterFee: 150000,
      description:
        'Nhà nguyên căn 2 tầng, 3 phòng ngủ, 2 WC. Hẻm rộng, yên tĩnh.',
      utilities: ['wifi', 'ac', 'parking', 'garden', 'washer'],
      images: [
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.PENDING,
    },
    {
      addressId: addresses[4].id,
      title: 'Phòng trọ sinh viên Hoàn Kiếm',
      type: ListingType.ROOM,
      price: 3000000,
      area: 18,
      electricityFee: 4000,
      waterFee: 60000,
      description: 'Phòng trọ dành cho sinh viên, gần ĐH Quốc Gia. Giá hợp lý.',
      utilities: ['wifi', 'ac', 'security'],
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.ACTIVE,
      expiredAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    },
    {
      addressId: addresses[6].id,
      title: 'Căn hộ biển Đà Nẵng',
      type: ListingType.APARTMENT,
      price: 8000000,
      area: 50,
      electricityFee: 3500,
      waterFee: 100000,
      description:
        'Căn hộ gần biển Mỹ Khê. View biển tuyệt đẹp, đầy đủ tiện nghi.',
      utilities: ['wifi', 'ac', 'pool', 'gym', 'security'],
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      ],
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      status: ListingStatus.DRAFT,
    },
  ];

  const listings = await Promise.all(
    listingData.map((data) =>
      prisma.listing.create({
        data: { ...data, ownerId: USER_1_ID },
      }),
    ),
  );

  console.log(`🏠 Created ${listings.length} listings`);

  // ─── Listing History ────────────────────────────────────────────────────────
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

  console.log('📋 Created listing history');

  // ─── Listing Views ──────────────────────────────────────────────────────────
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

  // Update viewCount
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

  console.log('👁️  Created listing views');

  // ─── Saved Listings ─────────────────────────────────────────────────────────
  await prisma.savedListing.createMany({
    data: [
      { userId: USER_2_ID, listingId: listings[0].id },
      { userId: USER_2_ID, listingId: listings[1].id },
      { userId: USER_2_ID, listingId: listings[4].id },
    ],
  });

  console.log('❤️  Created saved listings');

  // ─── Reviews ────────────────────────────────────────────────────────────────
  const review1 = await prisma.review.create({
    data: {
      listingId: listings[0].id,
      userId: USER_2_ID,
      rating: 5,
      comment:
        'Phòng rất sạch sẽ, chủ nhà thân thiện. Vị trí đẹp, gần nhiều tiện ích. Sẽ quay lại lần sau!',
      isVerified: true,
    },
  });

  const review2 = await prisma.review.create({
    data: {
      listingId: listings[1].id,
      userId: USER_2_ID,
      rating: 4,
      comment:
        'Căn hộ đẹp, đầy đủ nội thất. Hơi ồn vì gần đường lớn nhưng nhìn chung rất ổn.',
      isVerified: false,
    },
  });

  await prisma.reviewReply.create({
    data: {
      reviewId: review1.id,
      userId: USER_1_ID,
      content:
        'Cảm ơn bạn đã để lại đánh giá tích cực! Rất vui được đón tiếp bạn lần sau.',
    },
  });

  console.log('⭐ Created reviews & replies');

  // ─── Reports ────────────────────────────────────────────────────────────────
  await prisma.report.create({
    data: {
      reporterId: USER_2_ID,
      listingId: listings[5].id,
      reason: ReportReason.WRONG_INFO,
      detail: 'Giá phòng trong tin đăng khác với giá thực tế khi liên hệ.',
      status: ReportStatus.PENDING,
    },
  });

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

  console.log('🚨 Created reports');

  // ─── Notifications ──────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
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
        body: `${tenant.name} đã đánh giá 5⭐ cho tin đăng của bạn.`,
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
    ],
  });

  console.log('🔔 Created notifications');

  // ─── Chat & Messages ────────────────────────────────────────────────────────
  const chat = await prisma.chat.create({
    data: {
      user1Id: USER_1_ID,
      user2Id: USER_2_ID,
      listingId: listings[0].id,
    },
  });

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
      content: 'Ok bạn nhé! Mình sẽ đợi bạn. Địa chỉ là 12 Lý Tự Trọng, Q1.',
      type: MessageType.TEXT,
      isRead: false,
    },
  ];

  for (const msg of messageData) {
    await prisma.message.create({
      data: { chatId: chat.id, ...msg },
    });
  }

  console.log('💬 Created chat & messages');

  // ─── Done ───────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed completed successfully!');
  console.log('─'.repeat(50));
  console.log(
    `👤 Landlord  | ID: ${USER_1_ID} | email: landlord@accomfinder.vn`,
  );
  console.log(`👤 Tenant    | ID: ${USER_2_ID} | email: tenant@accomfinder.vn`);
  console.log(`👤 Admin     | ID: ${admin.id}   | email: admin@accomfinder.vn`);
  console.log(`🔑 Password  | password123 (all users)`);
  console.log('─'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
