import 'package:url_launcher/url_launcher.dart';
import '../models/subscription_plan.dart';
import 'storage_service.dart';

class PaymentService {
  // Merchant details
  static const String clickMerchantId = '12345';
  static const String clickServiceId = '67890';
  static const String paymeMerchantId = '660a123456789abcdef12345';

  // Generate Click Payment URL
  static String generateClickUrl({
    required SubscriptionPlan plan,
    required String userId,
  }) {
    final amount = plan.price.toInt();
    final returnUrl = 'https://xitfilm.uz/payment/success?plan=${plan.id}&user=$userId';
    return 'https://my.click.uz/services/pay?service_id=$clickServiceId&merchant_id=$clickMerchantId&amount=$amount&transaction_param=$userId&return_url=$returnUrl';
  }

  // Generate Payme Payment URL
  static String generatePaymeUrl({
    required SubscriptionPlan plan,
    required String userId,
  }) {
    final amountTiyin = (plan.price * 100).toInt(); // Payme uses tiyin
    return 'https://checkout.paycom.uz/checkout?merchant=$paymeMerchantId&amount=$amountTiyin&account[user_id]=$userId';
  }

  // Process Checkout
  static Future<bool> startCheckout({
    required PaymentProvider provider,
    required SubscriptionPlan plan,
  }) async {
    final userId = StorageService.getUserId();
    String url = '';

    switch (provider) {
      case PaymentProvider.click:
        url = generateClickUrl(plan: plan, userId: userId);
        break;
      case PaymentProvider.payme:
        url = generatePaymeUrl(plan: plan, userId: userId);
        break;
      case PaymentProvider.uzum:
        url = 'https://www.apelsin.uz/open-service?serviceId=xitfilm&amount=${plan.price}&userId=$userId';
        break;
    }

    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      // Fallback
    }

    return true;
  }

  // Complete/Simulate VIP Upgrade
  static Future<void> grantVipSubscription(SubscriptionPlan plan) async {
    final now = DateTime.now();
    final currentExpiry = StorageService.getVipExpiryDate();
    
    DateTime newExpiry;
    if (currentExpiry != null && currentExpiry.isAfter(now)) {
      newExpiry = currentExpiry.add(Duration(days: plan.durationDays));
    } else {
      newExpiry = now.add(Duration(days: plan.durationDays));
    }

    await StorageService.setVipStatus(true, newExpiry);
  }
}
