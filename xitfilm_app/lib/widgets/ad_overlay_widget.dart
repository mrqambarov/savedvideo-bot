import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/app_theme.dart';
import '../services/ad_service.dart';

class AdOverlayWidget extends StatefulWidget {
  final VideoAdItem ad;
  final VoidCallback onAdFinished;
  final VoidCallback onGoToVip;

  const AdOverlayWidget({
    super.key,
    required this.ad,
    required this.onAdFinished,
    required this.onGoToVip,
  });

  @override
  State<AdOverlayWidget> createState() => _AdOverlayWidgetState();
}

class _AdOverlayWidgetState extends State<AdOverlayWidget> {
  late int _remainingSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.ad.skipAfterSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        _timer?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: Colors.transparent,
        child: SafeArea(
          child: Stack(
            children: [
              // Top Bar: Ad Sponsor info & VIP Link
              Positioned(
                top: 12,
                left: 12,
                right: 12,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.black.withAlpha(200),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppTheme.borderDark),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.campaign_rounded, color: AppTheme.goldAccent, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            widget.ad.sponsorTag,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: widget.onGoToVip,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          gradient: AppTheme.vipGoldGradient,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.goldAccent.withAlpha(100),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.workspace_premium, color: Colors.black, size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Reklamasiz VIP',
                              style: TextStyle(
                                color: Colors.black,
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Bottom Right: Skip or Countdown Button
              Positioned(
                bottom: 24,
                right: 16,
                child: _remainingSeconds > 0
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(220),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.borderDark),
                        ),
                        child: Text(
                          'O\'tkazib yuborish: $_remainingSeconds s',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      )
                    : Container(
                        decoration: BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withAlpha(120),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          onPressed: widget.onAdFinished,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Kino davomiga o\'tish',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(Icons.skip_next_rounded, color: Colors.white, size: 18),
                            ],
                          ),
                        ),
                      ),
              ),

              // Bottom Left: Sponsor Action Button
              Positioned(
                bottom: 24,
                left: 16,
                child: GestureDetector(
                  onTap: () async {
                    try {
                      final uri = Uri.parse(widget.ad.ctaUrl);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    } catch (e) {
                      debugPrint('CTA launch error: $e');
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceLight.withAlpha(220),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.cyanAccent.withAlpha(140)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.open_in_new_rounded, color: AppTheme.cyanAccent, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          widget.ad.ctaText,
                          style: const TextStyle(
                            color: AppTheme.cyanAccent,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
