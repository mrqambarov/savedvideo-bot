import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import 'vip_badge.dart';

class HeroBanner extends StatelessWidget {
  final Movie movie;
  final VoidCallback onPlay;
  final VoidCallback onDetails;
  final VoidCallback? onOpenBot;

  const HeroBanner({
    super.key,
    required this.movie,
    required this.onPlay,
    required this.onDetails,
    this.onOpenBot,
  });

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Stack(
      children: [
        // Backdrop / Poster Image
        SizedBox(
          height: screenHeight * 0.52,
          width: double.infinity,
          child: CachedNetworkImage(
            imageUrl: movie.backdrop ?? movie.poster,
            fit: BoxFit.cover,
            errorWidget: (context, url, error) => Container(color: AppTheme.surface),
          ),
        ),

        // Dark Vignette & Gradient Overlays
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: AppTheme.darkOverlayGradient,
            ),
          ),
        ),

        // Top Gradient for Status bar
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 100,
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.black.withAlpha(200), Colors.transparent],
              ),
            ),
          ),
        ),

        // Hero Content
        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Badges Row
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (movie.isVip) ...[
                    const VipBadge(size: 11),
                    const SizedBox(width: 8),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black.withAlpha(160),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.cyanAccent.withAlpha(140)),
                    ),
                    child: Text(
                      movie.quality,
                      style: const TextStyle(
                        color: AppTheme.cyanAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.goldAccent.withAlpha(40),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.goldAccent.withAlpha(140)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.star_rounded, color: AppTheme.goldAccent, size: 14),
                        const SizedBox(width: 3),
                        Text(
                          '${movie.rating} IMDb',
                          style: const TextStyle(
                            color: AppTheme.goldAccent,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: movie.code));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Kino kodi nusxalandi: #${movie.code}'),
                          duration: const Duration(seconds: 2),
                          backgroundColor: AppTheme.surfaceLight,
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceLight.withAlpha(200),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppTheme.borderDark),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.key, color: AppTheme.textSecondary, size: 12),
                          const SizedBox(width: 4),
                          Text(
                            '#${movie.code}',
                            style: const TextStyle(
                              color: AppTheme.textPrimary,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 10),

              // Title
              Text(
                movie.title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  height: 1.2,
                ),
              ),

              const SizedBox(height: 6),

              // Sub info (Genre • Year • Duration)
              Text(
                '${movie.genre}  •  ${movie.year}  •  ${movie.duration ?? '1 soat 45 daqiqa'}',
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),

              const SizedBox(height: 16),

              // Action Buttons Row
              Row(
                children: [
                  // Play Button
                  Expanded(
                    flex: 5,
                    child: Container(
                      height: 46,
                      decoration: BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primary.withAlpha(120),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: onPlay,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.play_arrow_rounded, color: Colors.white, size: 26),
                            SizedBox(width: 6),
                            Text(
                              'Tomosha qilish',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(width: 10),

                  // Details Glass Button
                  Expanded(
                    flex: 4,
                    child: Container(
                      height: 46,
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceLight.withAlpha(180),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.borderDark, width: 1.2),
                      ),
                      child: ElevatedButton(
                        onPressed: onDetails,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.info_outline_rounded, color: AppTheme.textPrimary, size: 18),
                            SizedBox(width: 6),
                            Text(
                              'Batafsil',
                              style: TextStyle(
                                color: AppTheme.textPrimary,
                                fontSize: 13,
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
            ],
          ),
        ),
      ],
    );
  }
}
