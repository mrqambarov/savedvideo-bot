enum PaymentProvider { click, payme, uzum }

class SubscriptionPlan {
  final String id;
  final String title;
  final int durationDays;
  final double price;
  final String formattedPrice;
  final String? discountTag;
  final bool isPopular;
  final List<String> benefits;

  SubscriptionPlan({
    required this.id,
    required this.title,
    required this.durationDays,
    required this.price,
    required this.formattedPrice,
    this.discountTag,
    this.isPopular = false,
    required this.benefits,
  });

  static List<SubscriptionPlan> defaultPlans = [
    SubscriptionPlan(
      id: 'plan_1_month',
      title: '1 Oylik VIP',
      durationDays: 30,
      price: 19000,
      formattedPrice: "19 000 so'm",
      discountTag: null,
      isPopular: false,
      benefits: [
        'Barcha filmlar va seriallarni 4K sifatda ko\'rish',
        'Barcha reklamalarni to\'liq o\'chirib qo\'yish',
        'Premyera filmlarni eng birinchi bo\'lib tomosha qilish',
        'Yuqori tezlikdagi xususiy serverlar',
      ],
    ),
    SubscriptionPlan(
      id: 'plan_3_months',
      title: '3 Oylik VIP Mega',
      durationDays: 90,
      price: 45000,
      formattedPrice: "45 000 so'm",
      discountTag: '-20% TEJAMKOR',
      isPopular: true,
      benefits: [
        'Barcha 1 oylik imtiyozlar',
        '20% arzonroq narxda VIP obuna',
        'Cheksiz kinolarni oflayn yuklab olish',
        'VIP qo\'llab-quvvatlash xizmati',
      ],
    ),
    SubscriptionPlan(
      id: 'plan_1_year',
      title: '1 Yillik VIP Cheksiz',
      durationDays: 365,
      price: 140000,
      formattedPrice: "140 000 so'm",
      discountTag: '-40% MAKSIMAL',
      isPopular: false,
      benefits: [
        'To\'liq 1 yil davomida barcha filmlar bepul',
        '40% gacha ulkan tejamkorlik',
        'Yangi seriallarning barcha qismlari eksklyuziv',
        'Oila a\'zolari uchun 3 ta qurilmagacha ruxsat',
      ],
    ),
  ];
}
