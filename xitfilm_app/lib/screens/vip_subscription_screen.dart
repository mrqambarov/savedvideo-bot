import 'package:flutter/material.dart';
import '../constants/app_theme.dart';
import '../models/subscription_plan.dart';
import '../services/payment_service.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';

class VipSubscriptionScreen extends StatefulWidget {
  const VipSubscriptionScreen({super.key});

  @override
  State<VipSubscriptionScreen> createState() => _VipSubscriptionScreenState();
}

class _VipSubscriptionScreenState extends State<VipSubscriptionScreen> {
  int _selectedPlanIndex = 1; // Default to 3-month popular
  PaymentProvider _selectedProvider = PaymentProvider.click;
  final TextEditingController _promoController = TextEditingController();
  bool _isApplyingPromo = false;
  bool _isProcessingPayment = false;

  final List<SubscriptionPlan> _plans = SubscriptionPlan.defaultPlans;

  @override
  void dispose() {
    _promoController.dispose();
    super.dispose();
  }

  void _applyPromo() async {
    final code = _promoController.text.trim();
    if (code.isEmpty) return;

    setState(() => _isApplyingPromo = true);
    final result = await ApiService.applyPromoCode(code);
    setState(() => _isApplyingPromo = false);
    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Promo-kod muvaffaqiyatli faollashtirildi!'),
          backgroundColor: AppTheme.successGreen,
        ),
      );
      setState(() {});
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Noto\'g\'ri promo-kod'),
          backgroundColor: AppTheme.primary,
        ),
      );
    }
  }

  void _handlePayment() async {
    final plan = _plans[_selectedPlanIndex];
    setState(() => _isProcessingPayment = true);

    await PaymentService.startCheckout(
      provider: _selectedProvider,
      plan: plan,
    );

    // Auto-grant for demo simulation
    await PaymentService.grantVipSubscription(plan);

    setState(() => _isProcessingPayment = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Tabriklaymiz! ${plan.title} muvaffaqiyatli faollashtirildi 👑'),
          backgroundColor: AppTheme.successGreen,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isUserVip = StorageService.isVip();
    final expiryDate = StorageService.getVipExpiryDate();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('XIT FILM VIP Premium', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // VIP Status Banner if Active
            if (isUserVip) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: AppTheme.vipGoldGradient,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(color: AppTheme.goldAccent.withAlpha(120), blurRadius: 16),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('👑 SIZNING VIP STATUSINGIZ FAOL', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w900, fontSize: 14)),
                        Icon(Icons.verified, color: Colors.black, size: 22),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      expiryDate != null
                          ? 'Amal qilish muddati: ${expiryDate.day}.${expiryDate.month}.${expiryDate.year} gacha'
                          : 'Cheksiz VIP a\'zolik',
                      style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.w600, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Hero Benefits Section
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('VIP Imtiyozlari 👑', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 14),
                  _buildBenefitRow(Icons.block, '100% Reklamasiz Ko\'rish', 'Barcha pre-roll va oraliq reklamalar butunlay o\'chiriladi'),
                  const SizedBox(height: 10),
                  _buildBenefitRow(Icons.hd_rounded, '4K Ultra HD & Dolby Audio', 'Maksimal sifatda, qotmasdan tezkor serverlar orqali uzatiladi'),
                  const SizedBox(height: 10),
                  _buildBenefitRow(Icons.new_releases_rounded, 'Premyeralar Eng Birinchi', 'Yangi seriallar va kinolarning barcha qismlari siz uchun ochiq'),
                  const SizedBox(height: 10),
                  _buildBenefitRow(Icons.download_for_offline_rounded, 'Cheksiz Oflayn Yuklash', 'Telegram bot va ilovada to\'g\'ridan-to\'g\'ri yuklab olish imkoniyati'),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Subscription Plans
            const Text('Tarifni Tanlang', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),

            ..._plans.asMap().entries.map((entry) {
              final idx = entry.key;
              final plan = entry.value;
              final isSelected = idx == _selectedPlanIndex;

              return GestureDetector(
                onTap: () => setState(() => _selectedPlanIndex = idx),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.surfaceLight : AppTheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isSelected ? AppTheme.cyanAccent : AppTheme.borderDark,
                      width: isSelected ? 2 : 1,
                    ),
                    boxShadow: isSelected
                        ? [BoxShadow(color: AppTheme.cyanAccent.withAlpha(40), blurRadius: 10)]
                        : [],
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                        color: isSelected ? AppTheme.cyanAccent : AppTheme.textMuted,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  plan.title,
                                  style: TextStyle(
                                    color: isSelected ? Colors.white : AppTheme.textPrimary,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                                if (plan.discountTag != null) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primary,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      plan.discountTag!,
                                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${plan.durationDays} kunlik to\'liq VIP ruxsat',
                              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        plan.formattedPrice,
                        style: TextStyle(
                          color: isSelected ? AppTheme.cyanAccent : Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 20),

            // Payment Methods (Click, Payme, Uzum)
            const Text('To\'lov Tizimini Tanlang', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildPaymentMethodOption(PaymentProvider.click, 'CLICK', Icons.payment, const Color(0xFF007AFF)),
                const SizedBox(width: 10),
                _buildPaymentMethodOption(PaymentProvider.payme, 'PAYME', Icons.credit_card, const Color(0xFF00CCCC)),
                const SizedBox(width: 10),
                _buildPaymentMethodOption(PaymentProvider.uzum, 'UZUM', Icons.account_balance_wallet, const Color(0xFF7000FF)),
              ],
            ),

            const SizedBox(height: 24),

            // Pay Action Button
            Container(
              height: 52,
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(color: AppTheme.primary.withAlpha(140), blurRadius: 16, offset: const Offset(0, 4)),
                ],
              ),
              child: ElevatedButton(
                onPressed: _isProcessingPayment ? null : _handlePayment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _isProcessingPayment
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock_open_rounded, color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            '${_plans[_selectedPlanIndex].formattedPrice} — To\'lov Qilish',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                          ),
                        ],
                      ),
              ),
            ),

            const SizedBox(height: 24),

            // Promo Code Box
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Promo-kod bormi?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _promoController,
                          style: const TextStyle(color: Colors.white),
                          textCapitalization: TextCapitalization.characters,
                          decoration: InputDecoration(
                            hintText: 'Masalan: XIT2026',
                            hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                            filled: true,
                            fillColor: AppTheme.surfaceLight,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(
                        onPressed: _isApplyingPromo ? null : _applyPromo,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.surfaceLight,
                          foregroundColor: AppTheme.cyanAccent,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: const BorderSide(color: AppTheme.cyanAccent),
                          ),
                        ),
                        child: _isApplyingPromo
                            ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: AppTheme.cyanAccent, strokeWidth: 2))
                            : const Text('Qo\'llash', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildBenefitRow(IconData icon, String title, String desc) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: AppTheme.cyanAccent.withAlpha(30),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppTheme.cyanAccent, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 2),
              Text(desc, style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentMethodOption(PaymentProvider provider, String name, IconData icon, Color brandColor) {
    final isSelected = _selectedProvider == provider;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedProvider = provider),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? brandColor.withAlpha(40) : AppTheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? brandColor : AppTheme.borderDark,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? brandColor : AppTheme.textSecondary, size: 22),
              const SizedBox(height: 6),
              Text(
                name,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppTheme.textSecondary,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
