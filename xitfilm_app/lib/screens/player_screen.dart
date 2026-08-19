import 'package:flutter/material.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import '../models/episode.dart';
import '../widgets/custom_video_player.dart';
import 'vip_subscription_screen.dart';

class PlayerScreen extends StatefulWidget {
  final Movie movie;
  final Episode? initialEpisode;

  const PlayerScreen({
    super.key,
    required this.movie,
    this.initialEpisode,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  Episode? _currentEpisode;

  @override
  void initState() {
    super.initState();
    _currentEpisode = widget.initialEpisode;
  }

  void _handleNextEpisode() {
    if (!widget.movie.isSeries || widget.movie.seasons.isEmpty) return;
    final allEpisodes = widget.movie.seasons.expand((s) => s.episodes).toList();
    if (_currentEpisode == null) {
      if (allEpisodes.length > 1) {
        setState(() => _currentEpisode = allEpisodes[1]);
      }
    } else {
      final currentIndex = allEpisodes.indexWhere((e) => e.id == _currentEpisode!.id);
      if (currentIndex >= 0 && currentIndex + 1 < allEpisodes.length) {
        setState(() => _currentEpisode = allEpisodes[currentIndex + 1]);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Keyingi qism boshlanmoqda: ${_currentEpisode!.title}'),
            backgroundColor: AppTheme.surfaceLight,
          ),
        );
      }
    }
  }

  void _goToVip() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (context) => const VipSubscriptionScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final movie = widget.movie;
    final allEpisodes = movie.isSeries ? movie.seasons.expand((s) => s.episodes).toList() : <Episode>[];

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // Video Player
            CustomVideoPlayer(
              key: ValueKey(_currentEpisode?.id ?? movie.code),
              movie: movie,
              episode: _currentEpisode,
              onNextEpisode: _handleNextEpisode,
              onGoToVip: _goToVip,
            ),

            // Below Player Content
            Expanded(
              child: Container(
                color: AppTheme.background,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Title and episode name
                    Text(
                      _currentEpisode != null
                          ? '${movie.title} • ${_currentEpisode!.title}'
                          : movie.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${movie.genre}  •  ${movie.year}  •  ${movie.quality}',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    ),

                    const SizedBox(height: 16),

                    // If Series: Quick Episode Picker List
                    if (movie.isSeries && allEpisodes.isNotEmpty) ...[
                      const Text(
                        'Barcha qismlar',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 10),
                      ...allEpisodes.map((ep) {
                        final isPlaying = _currentEpisode?.id == ep.id;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: isPlaying ? AppTheme.primary.withAlpha(40) : AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isPlaying ? AppTheme.primary : AppTheme.borderDark,
                            ),
                          ),
                          child: ListTile(
                            leading: Icon(
                              isPlaying ? Icons.play_circle_filled : Icons.play_circle_outline,
                              color: isPlaying ? AppTheme.primary : AppTheme.cyanAccent,
                            ),
                            title: Text(
                              ep.title,
                              style: TextStyle(
                                color: isPlaying ? AppTheme.primary : Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                            subtitle: Text(ep.duration ?? '45 daq', style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                            trailing: ep.isVip
                                ? Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.goldAccent.withAlpha(40),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text('VIP', style: TextStyle(color: AppTheme.goldAccent, fontSize: 10, fontWeight: FontWeight.w900)),
                                  )
                                : null,
                            onTap: () {
                              setState(() => _currentEpisode = ep);
                            },
                          ),
                        );
                      }),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
