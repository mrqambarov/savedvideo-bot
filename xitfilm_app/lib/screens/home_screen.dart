import 'package:flutter/material.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/hero_banner.dart';
import '../widgets/movie_card.dart';
import '../widgets/vip_badge.dart';
import '../widgets/telegram_sub_dialog.dart';
import 'movie_detail_screen.dart';
import 'player_screen.dart';
import 'vip_subscription_screen.dart';

class HomeScreen extends StatefulWidget {
  final Function(int)? onNavigateTab;

  const HomeScreen({super.key, this.onNavigateTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Movie> _movies = [];
  bool _isLoading = true;
  Map<String, dynamic> _continueWatching = {};

  @override
  void initState() {
    super.initState();
    _loadHomeData();
  }

  Future<void> _loadHomeData() async {
    final list = await ApiService.fetchMovies();
    final progress = StorageService.getAllProgress();
    if (mounted) {
      setState(() {
        _movies = list;
        _continueWatching = progress;
        _isLoading = false;
      });
    }
  }

  void _openPlayer(Movie movie) {
    if (movie.isVip && !StorageService.isVip()) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (context) => const VipSubscriptionScreen()),
      );
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => PlayerScreen(movie: movie),
      ),
    );
  }

  void _openDetails(Movie movie) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => MovieDetailScreen(movie: movie),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppTheme.background,
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.cyanAccent),
        ),
      );
    }

    final heroMovies = _movies.take(4).toList();
    final premieres = _movies;
    final top10 = List<Movie>.from(_movies)..sort((a, b) => b.rating.compareTo(a.rating));
    final series = _movies.where((m) => m.isSeries).toList();
    final vipMovies = _movies.where((m) => m.isVip).toList();

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: RefreshIndicator(
        onRefresh: _loadHomeData,
        color: AppTheme.cyanAccent,
        backgroundColor: AppTheme.surface,
        child: CustomScrollView(
          slivers: [
            // Custom Glassy App Bar
            SliverAppBar(
              floating: true,
              backgroundColor: AppTheme.background.withAlpha(220),
              elevation: 0,
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      gradient: AppTheme.primaryGradient,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withAlpha(120),
                          blurRadius: 10,
                        ),
                      ],
                    ),
                    child: const Text('🎬', style: TextStyle(fontSize: 16)),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'XIT',
                    style: TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const Text(
                    'FILM',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.cyanAccent.withAlpha(40),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: AppTheme.cyanAccent.withAlpha(140)),
                    ),
                    child: const Text(
                      '4K',
                      style: TextStyle(
                        color: AppTheme.cyanAccent,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              actions: [
                // Telegram Bot Shortcut
                IconButton(
                  icon: const Icon(Icons.telegram, color: Color(0xFF229ED9), size: 26),
                  tooltip: 'Telegram Bot',
                  onPressed: () {
                    TelegramSubDialog.show(context, onVerified: () {});
                  },
                ),
                // VIP Shortcut
                Padding(
                  padding: const EdgeInsets.only(right: 12.0),
                  child: GestureDetector(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (context) => const VipSubscriptionScreen()),
                      );
                    },
                    child: const VipBadge(size: 11),
                  ),
                ),
              ],
            ),

            // Hero Carousel Slider
            if (heroMovies.isNotEmpty)
              SliverToBoxAdapter(
                child: CarouselSlider.builder(
                  itemCount: heroMovies.length,
                  options: CarouselOptions(
                    height: 440,
                    viewportFraction: 1.0,
                    autoPlay: true,
                    autoPlayInterval: const Duration(seconds: 7),
                  ),
                  itemBuilder: (context, index, realIndex) {
                    final m = heroMovies[index];
                    return HeroBanner(
                      movie: m,
                      onPlay: () => _openPlayer(m),
                      onDetails: () => _openDetails(m),
                    );
                  },
                ),
              ),

            // Continue Watching Section
            if (_continueWatching.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 16.0, bottom: 8.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16.0),
                        child: Row(
                          children: [
                            Icon(Icons.history_toggle_off_rounded, color: AppTheme.cyanAccent, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Ko\'rishni davom ettirish',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 140,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          children: _continueWatching.values.map((item) {
                            final progressMap = Map<String, dynamic>.from(item);
                            final code = progressMap['code']?.toString() ?? '';
                            final title = progressMap['title'] ?? 'Kino';
                            final poster = progressMap['poster'] ?? '';
                            final cur = progressMap['currentSeconds'] as int? ?? 0;
                            final tot = progressMap['totalSeconds'] as int? ?? 1;
                            final ratio = (cur / (tot > 0 ? tot : 1)).clamp(0.0, 1.0);

                            final matchedMovie = _movies.firstWhere(
                              (m) => m.code == code,
                              orElse: () => _movies.first,
                            );

                            return GestureDetector(
                              onTap: () => _openPlayer(matchedMovie),
                              child: Container(
                                width: 200,
                                margin: const EdgeInsets.only(right: 12),
                                decoration: BoxDecoration(
                                  color: AppTheme.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppTheme.borderDark),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          ClipRRect(
                                            borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                                            child: CachedNetworkImage(
                                              imageUrl: poster,
                                              fit: BoxFit.cover,
                                              errorWidget: (context, url, error) => Container(color: AppTheme.surfaceLight),
                                            ),
                                          ),
                                          Center(
                                            child: Container(
                                              padding: const EdgeInsets.all(8),
                                              decoration: BoxDecoration(
                                                color: Colors.black.withAlpha(160),
                                                shape: BoxShape.circle,
                                              ),
                                              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 28),
                                            ),
                                          ),
                                          Positioned(
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            child: LinearProgressIndicator(
                                              value: ratio,
                                              backgroundColor: Colors.black.withAlpha(150),
                                              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
                                              minHeight: 4,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(8.0),
                                      child: Text(
                                        title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Premyeralar Row
            SliverToBoxAdapter(
              child: _buildSection(
                title: '🔥 Yangi Premyeralar 2026',
                movies: premieres,
                onSeeAll: () => widget.onNavigateTab?.call(1),
              ),
            ),

            // Top 10 Ranked Row
            if (top10.isNotEmpty)
              SliverToBoxAdapter(
                child: _buildTop10Section(top10),
              ),

            // Seriallar Row
            if (series.isNotEmpty)
              SliverToBoxAdapter(
                child: _buildSection(
                  title: '📺 O\'zbek tilidagi Seriallar',
                  movies: series,
                  onSeeAll: () => widget.onNavigateTab?.call(1),
                ),
              ),

            // VIP Section Row
            if (vipMovies.isNotEmpty)
              SliverToBoxAdapter(
                child: _buildSection(
                  title: '👑 VIP Eksklyuziv Filmlar',
                  movies: vipMovies,
                  onSeeAll: () => widget.onNavigateTab?.call(3),
                ),
              ),

            const SliverToBoxAdapter(
              child: SizedBox(height: 30),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<Movie> movies,
    VoidCallback? onSeeAll,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (onSeeAll != null)
                  GestureDetector(
                    onTap: onSeeAll,
                    child: const Text(
                      'Barchasi >',
                      style: TextStyle(
                        color: AppTheme.cyanAccent,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 270,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: movies.length,
              itemBuilder: (context, index) {
                final movie = movies[index];
                return MovieCard(
                  movie: movie,
                  onTap: () => _openDetails(movie),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTop10Section(List<Movie> movies) {
    final topItems = movies.take(10).toList();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0),
            child: Text(
              '🏆 Top 10 Eng Sara Filmlar',
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 280,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: topItems.length,
              itemBuilder: (context, index) {
                final movie = topItems[index];
                return Padding(
                  padding: const EdgeInsets.only(left: 10.0),
                  child: MovieCard(
                    movie: movie,
                    showRank: true,
                    rank: index + 1,
                    onTap: () => _openDetails(movie),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
