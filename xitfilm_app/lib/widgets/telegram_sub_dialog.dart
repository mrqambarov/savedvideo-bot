import 'package:flutter/material.dart';
import '../constants/app_theme.dart';
import '../services/telegram_service.dart';

class TelegramSubDialog extends StatefulWidget {
  final VoidCallback onVerified;

  const TelegramSubDialog({
    super.key,
    required this.onVerified,
  });

  static Future<void> show(BuildContext context, {required VoidCallback onVerified}) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => TelegramSubDialog(onVerified: onVerified),
    );
  }

  @override
  State<TelegramSubDialog> createState() => _TelegramSubDialogState();
}

class _TelegramSubDialogState extends State<TelegramSubDialog> {
  bool _isChecking = false;

  Future<void> _handleCheck() async {
    setState(() => _isChecking = true);
    await Future.delayed(const Duration(milliseconds: 1200));
    if (mounted) {
      setState(() => _isChecking = false);
      Navigator.of(context).pop();
      widget.onVerified();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Obuna tasdiqlandi! Maroqli hordiq tilaymiz 🍿'),
          backgroundColor: AppTheme.successGreen,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppTheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppTheme.borderDark, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(22.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF229ED9).withAlpha(40),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.telegram,
                color: Color(0xFF229ED9),
                size: 44,
              ),
            ),

            const SizedBox(height: 16),

            // Title
            const Text(
              'Homiy Kanalga A\'zo Bo\'ling',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),

            const SizedBox(height: 8),

            // Description
            const Text(
              'Filmlarni yuqori 4K sifatda tomosha qilish uchun rasmiy Telegram kanalimizga a\'zo bo\'lishingiz lozim:',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),

            const SizedBox(height: 16),

            // Channel Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.surfaceLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: Color(0xFF229ED9),
                    radius: 18,
                    child: Text('🎬', style: TextStyle(fontSize: 16)),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'XIT FILM | Rasmiy Kanal',
                          style: TextStyle(
                            color: AppTheme.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '@xitfilm_uz',
                          style: TextStyle(
                            color: Color(0xFF229ED9),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => TelegramService.openChannel(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF229ED9),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('A\'zo bo\'lish', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Verify Button
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: _isChecking ? null : _handleCheck,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isChecking
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Text(
                        '✅ Obunani Tekshirish',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
