import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import '../models/episode.dart';
import '../models/review.dart';
import '../services/storage_service.dart';
import '../services/telegram_service.dart';
import '../services/api_service.dart';
import '../widgets/vip_badge.dart';
import '../widgets/movie_card.dart';
import 'player_screen.dart';
import 'vip_subscription_screen.dart';

class MovieDetailScreen extends StatefulWidget {
  final Movie movie;

  const MovieDetailScreen({super.key, required this.movie});

  @override
  State<MovieDetailScreen> createState() => _MovieDetailScreenState();
}

class _MovieDetailScreenState extends State<MovieDetailScreen> {
  bool _isFavorite = false;
  int _selectedSeasonIndex = 0;
  List<Review> _reviews = [];
  bool _isLoadingReviews = true;
  final TextEditingController _commentController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  double _userRating = 5.0;

  @override
  void initState() {
    super.initState();
    _isFavorite = StorageService.isFavorite(widget.movie.code);
    _loadReviews();
  }

  Future<void> _loadReviews() async {
    final list = await ApiService.fetchReviews(widget.movie.code);
    if (mounted) {
      setState(() {
        _reviews = list;
        _isLoadingReviews = false;
      });
    }
  }

  void _toggleFavorite() async {
    final added = await StorageService.toggleFavorite(widget.movie.code);
    if (!mounted) return;
    setState(() => _isFavorite = added);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(added ? 'Sevimlilarga qo\'shildi ⭐' : 'Sevimlilardan o\'chirildi'),
        duration: const Duration(seconds: 1),
        backgroundColor: AppTheme.surfaceLight,
      ),
    );
  }

  void _openPlayer({Episode? episode}) {
    // Check if VIP is required
    final isContentVip = episode?.isVip ?? widget.movie.isVip;
    if (isContentVip && !StorageService.isVip()) {
      _showVipGateModal();
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => PlayerScreen(
          movie: widget.movie,
          initialEpisode: episode,
        ),
      ),
    );
  }

  void _showVipGateModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const VipBadge(size: 16),
            const SizedBox(height: 16),
            const Text(
              'VIP Eksklyuziv Kontent 👑',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Ushbu film yoki epizod faqat VIP obunachilar uchun ochiq. Barcha reklamalardan xalos bo\'ling va 4K sifatda tomosha qiling.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const VipSubscriptionScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('VIP Obunani Faollashtirish', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddReviewModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (bottomSheetContext) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(bottomSheetContext).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Kino haqida fikringiz', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  return IconButton(
                    icon: Icon(
                      index < _userRating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: AppTheme.goldAccent,
                      size: 32,
                    ),
                    onPressed: () {
                      setModalState(() => _userRating = (index + 1).toDouble());
                    },
                  );
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _nameController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Ismingiz yoki taxallusingiz',
                  hintStyle: const TextStyle(color: AppTheme.textMuted),
                  filled: true,
                  fillColor: AppTheme.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _commentController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Fikringizni yozing...',
                  hintStyle: const TextStyle(color: AppTheme.textMuted),
                  filled: true,
                  fillColor: AppTheme.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  onPressed: () async {
                    if (_commentController.text.trim().isEmpty) return;
                    final name = _nameController.text.trim().isEmpty ? 'Foydalanuvchi' : _nameController.text.trim();
                    await ApiService.addReview(
                      widget.movie.code,
                      name: name,
                      rating: _userRating,
                      comment: _commentController.text.trim(),
                    );
                    if (!bottomSheetContext.mounted) return;
                    Navigator.pop(bottomSheetContext);
                    _loadReviews();
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Fikringiz uchun rahmat!'), backgroundColor: AppTheme.successGreen),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Yuborish', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _commentController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final movie = widget.movie;
    final seasons = movie.seasons;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: CustomScrollView(
        slivers: [
          // Sliver App Bar with Hero Image
          SliverAppBar(
            expandedHeight: 340,
            pinned: true,
            backgroundColor: AppTheme.surface,
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(150),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
            actions: [
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(150),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isFavorite ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded,
                    color: _isFavorite ? AppTheme.goldAccent : Colors.white,
                    size: 20,
                  ),
                ),
                onPressed: _toggleFavorite,
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: movie.backdrop ?? movie.poster,
                    fit: BoxFit.cover,
                  ),
                  Container(
                    decoration: const BoxDecoration(
                      gradient: AppTheme.darkOverlayGradient,
                    ),
                  ),
                  // Center Play Floating Button
                  Center(
                    child: GestureDetector(
                      onTap: () => _openPlayer(),
                      child: Container(
                        height: 64,
                        width: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: AppTheme.primaryGradient,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withAlpha(160),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 38),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Main Detail Body
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title & Code
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          movie.title,
                          style: const TextStyle(
                            color: AppTheme.textPrimary,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: movie.code));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Kod #${movie.code} nusxalandi'),
                              duration: const Duration(seconds: 1),
                              backgroundColor: AppTheme.surfaceLight,
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.cyanAccent.withAlpha(120)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.copy_rounded, color: AppTheme.cyanAccent, size: 13),
                              const SizedBox(width: 4),
                              Text('#${movie.code}', style: const TextStyle(color: AppTheme.cyanAccent, fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Meta Pills Row (Quality, Rating, Year, Genre, VIP)
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (movie.isVip) const VipBadge(size: 11),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.borderDark),
                        ),
                        child: Text(movie.quality, style: const TextStyle(color: AppTheme.cyanAccent, fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.goldAccent.withAlpha(40),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.goldAccent.withAlpha(120)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star_rounded, color: AppTheme.goldAccent, size: 14),
                            const SizedBox(width: 3),
                            Text('${movie.rating} IMDb', style: const TextStyle(color: AppTheme.goldAccent, fontSize: 11, fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.borderDark),
                        ),
                        child: Text(movie.year, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.borderDark),
                        ),
                        child: Text(movie.genre, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Action Buttons Row (Play Movie / Download Bot)
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: AppTheme.primaryGradient,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(color: AppTheme.primary.withAlpha(120), blurRadius: 12, offset: const Offset(0, 4)),
                            ],
                          ),
                          child: ElevatedButton(
                            onPressed: () => _openPlayer(),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
                                SizedBox(width: 6),
                                Text('Tomosha qilish', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFF229ED9).withAlpha(40),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF229ED9).withAlpha(140)),
                        ),
                        child: IconButton(
                          icon: const Icon(Icons.telegram, color: Color(0xFF229ED9), size: 24),
                          tooltip: 'Telegram botda yuklab olish',
                          onPressed: () => TelegramService.openMovieInBot(movie.code),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Description
                  const Text('Film haqida', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(
                    movie.description,
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
                  ),

                  const SizedBox(height: 24),

                  // Series & Episodes Tab Section
                  if (movie.isSeries && seasons.isNotEmpty) ...[
                    const Text('Qismlar va Fasllar', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    // Seasons Selector Tabs
                    if (seasons.length > 1)
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: seasons.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final season = entry.value;
                            final isSel = idx == _selectedSeasonIndex;
                            return GestureDetector(
                              onTap: () => setState(() => _selectedSeasonIndex = idx),
                              child: Container(
                                margin: const EdgeInsets.only(right: 10),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isSel ? AppTheme.primary : AppTheme.surfaceLight,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: isSel ? AppTheme.primary : AppTheme.borderDark),
                                ),
                                child: Text(
                                  season.title,
                                  style: TextStyle(
                                    color: isSel ? Colors.white : AppTheme.textSecondary,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    const SizedBox(height: 12),
                    // Episodes List
                    ...seasons[_selectedSeasonIndex].episodes.map((ep) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.borderDark),
                        ),
                        child: Row(
                          children: [
                            // Episode Thumbnail / Number Box
                            Container(
                              height: 50,
                              width: 70,
                              decoration: BoxDecoration(
                                color: Colors.black,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Center(
                                child: ep.isVip
                                    ? const Icon(Icons.lock, color: AppTheme.goldAccent, size: 20)
                                    : const Icon(Icons.play_circle_outline, color: AppTheme.cyanAccent, size: 24),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    ep.title,
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    ep.duration ?? '45 daq',
                                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () => _openPlayer(episode: ep),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: ep.isVip ? AppTheme.goldAccent : AppTheme.primary,
                                foregroundColor: ep.isVip ? Colors.black : Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              child: Text(
                                ep.isVip ? 'VIP' : 'Ko\'rish',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 24),
                  ],

                  // User Reviews Section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Fikr va Sharhlar', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                      TextButton.icon(
                        onPressed: _showAddReviewModal,
                        icon: const Icon(Icons.edit_note, color: AppTheme.cyanAccent, size: 18),
                        label: const Text('Fikr bildirish', style: TextStyle(color: AppTheme.cyanAccent, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),

                  if (_isLoadingReviews)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppTheme.cyanAccent)))
                  else if (_reviews.isEmpty)
                    const Text('Hozircha sharhlar mavjud emas. Birinchi bo\'lib fikr qoldiring!', style: TextStyle(color: AppTheme.textMuted, fontSize: 12))
                  else
                    ..._reviews.map((rev) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppTheme.borderDark),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(rev.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                                  Row(
                                    children: [
                                      const Icon(Icons.star_rounded, color: AppTheme.goldAccent, size: 14),
                                      const SizedBox(width: 2),
                                      Text('${rev.rating}', style: const TextStyle(color: AppTheme.goldAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(rev.comment, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                            ],
                          ),
                        )),

                  const SizedBox(height: 24),

                  // Similar Movies Section
                  const Text('Tavsiya etiladigan filmlar', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 220,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: ApiService.fallbackMovies.length,
                      itemBuilder: (context, index) {
                        final simMovie = ApiService.fallbackMovies[index];
                        if (simMovie.code == movie.code) return const SizedBox.shrink();
                        return MovieCard(
                          movie: simMovie,
                          onTap: () {
                            Navigator.of(context).pushReplacement(
                              MaterialPageRoute(builder: (context) => MovieDetailScreen(movie: simMovie)),
                            );
                          },
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
