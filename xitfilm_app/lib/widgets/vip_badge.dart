import 'package:flutter/material.dart';
import '../constants/app_theme.dart';

class VipBadge extends StatelessWidget {
  final double size;
  final bool isPro;

  const VipBadge({
    super.key,
    this.size = 13.0,
    this.isPro = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        gradient: isPro ? AppTheme.vipGoldGradient : AppTheme.cyanGradient,
        borderRadius: BorderRadius.circular(6),
        boxShadow: [
          BoxShadow(
            color: (isPro ? AppTheme.goldAccent : AppTheme.cyanAccent).withAlpha(100),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPro ? Icons.workspace_premium : Icons.stars,
            color: Colors.black,
            size: size + 2,
          ),
          const SizedBox(width: 4),
          Text(
            isPro ? 'VIP' : 'PRO',
            style: TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.w900,
              fontSize: size,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
