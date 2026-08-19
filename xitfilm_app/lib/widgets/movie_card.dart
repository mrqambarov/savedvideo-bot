import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import 'vip_badge.dart';

class MovieCard extends StatelessWidget {
  final Movie movie;
  final VoidCallback onTap;
  final double width;
  final double height;
  final bool showRank;
  final int? rank;

  const MovieCard({
    super.key,
    required this.movie,
    required this.onTap,
    this.width = 140,
    this.height = 210,
    this.showRank = false,
    this.rank,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Poster Container
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: height,
                  width: width,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderDark, width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(120),
                        blurRadius: 10,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(11),
                    child: CachedNetworkImage(
                      imageUrl: movie.poster,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Shimmer.fromColors(
                        baseColor: AppTheme.surface,
                        highlightColor: AppTheme.surfaceLight,
                        child: Container(color: AppTheme.surface),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: AppTheme.surface,
                        child: const Icon(Icons.movie_creation_outlined, color: AppTheme.textMuted, size: 36),
                      ),
                    ),
                  ),
                ),

                // Gradient Bottom Shade on Poster
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 60,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(11)),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black.withAlpha(200)],
                      ),
                    ),
                  ),
                ),

                // Top Right: VIP Badge or Quality Tag
                Positioned(
                  top: 8,
                  right: 8,
                  child: movie.isVip
                      ? const VipBadge(size: 10)
                      : Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.black.withAlpha(180),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppTheme.cyanAccent.withAlpha(120), width: 0.8),
                          ),
                          child: Text(
                            movie.quality.contains('4K') ? '4K' : 'HD',
                            style: const TextStyle(
                              color: AppTheme.cyanAccent,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                ),

                // Top Left: Series Badge if applicable
                if (movie.isSeries)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withAlpha(220),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'SERIAL',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),

                // Bottom Left: Rating Pill
                Positioned(
                  bottom: 8,
                  left: 8,
                  child: Row(
                    children: [
                      const Icon(Icons.star_rounded, color: AppTheme.goldAccent, size: 14),
                      const SizedBox(width: 2),
                      Text(
                        movie.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),

                // Bottom Right: Year
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Text(
                    movie.year,
                    style: const TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

                // Rank Number for Top 10 lists
                if (showRank && rank != null)
                  Positioned(
                    bottom: -15,
                    left: -10,
                    child: Text(
                      '$rank',
                      style: TextStyle(
                        fontSize: 64,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.primary,
                        shadows: [
                          Shadow(
                            color: Colors.black.withAlpha(240),
                            offset: const Offset(2, 2),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 8),

            // Title
            Text(
              movie.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),

            const SizedBox(height: 2),

            // Genre & Code
            Row(
              children: [
                Expanded(
                  child: Text(
                    movie.genre,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppTheme.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceLight,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    '#${movie.code}',
                    style: const TextStyle(
                      color: AppTheme.cyanAccent,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
