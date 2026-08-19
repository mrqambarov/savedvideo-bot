import 'package:flutter/material.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/telegram_service.dart';
import '../widgets/vip_badge.dart';
import '../widgets/movie_card.dart';
import 'movie_detail_screen.dart';
import 'vip_subscription_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Movie> _favoriteMovies = [];
  List<Movie> _historyMovies = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadUserMovies();
  }

  Future<void> _loadUserMovies() async {
    final movies = await ApiService.fetchMovies();
    final favCodes = StorageService.getFavorites();
    final histCodes = StorageService.getHistory();

    final favs = movies.where((m) => favCodes.contains(m.code)).toList();
    final hists = histCodes.map((c) => movies.firstWhere((m) => m.code == c, orElse: () => movies[0])).toList();

    if (mounted) {
      setState(() {
        _favoriteMovies = favs;
        _historyMovies = hists;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final userId = StorageService.getUserId();
    final isVip = StorageService.isVip();
    final vipExpiry = StorageService.getVipExpiryDate();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Profil va Xatcho\'plar', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        actions: [
          IconButton(
            icon: const Icon(Icons.telegram, color: Color(0xFF229ED9), size: 26),
            tooltip: 'Telegram Botga o\'tish',
            onPressed: () => TelegramService.openChannel(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.cyanAccent))
          : Column(
              children: [
                // User Card
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: isVip ? AppTheme.goldAccent : AppTheme.primary,
                          child: Text(
                            isVip ? '👑' : '🎬',
                            style: const TextStyle(fontSize: 26),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    isVip ? 'VIP Foydalanuvchi' : 'Xit Film A\'zosi',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16,
                                    ),
                                  ),
                                  if (isVip) ...[
                                    const SizedBox(width: 8),
                                    const VipBadge(size: 10),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'ID: $userId',
                                style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                isVip && vipExpiry != null
                                    ? 'VIP muddati: ${vipExpiry.day}.${vipExpiry.month}.${vipExpiry.year}'
                                    : 'Reklamasiz va 4K uchun VIP sotib oling',
                                style: TextStyle(
                                  color: isVip ? AppTheme.goldAccent : AppTheme.cyanAccent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.workspace_premium_rounded, color: AppTheme.goldAccent, size: 28),
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (context) => const VipSubscriptionScreen()),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                // Tab Bar (Favorites vs History)
                TabBar(
                  controller: _tabController,
                  indicatorColor: AppTheme.primary,
                  indicatorWeight: 3,
                  labelColor: Colors.white,
                  unselectedLabelColor: AppTheme.textMuted,
                  tabs: [
                    Tab(text: '⭐ Sevimlilar (${_favoriteMovies.length})'),
                    Tab(text: '🕒 Ko\'rish Tarixi (${_historyMovies.length})'),
                  ],
                ),

                // Tab Views
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      // Favorites Grid
                      _favoriteMovies.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.bookmark_border_rounded, color: AppTheme.textMuted, size: 50),
                                  const SizedBox(height: 10),
                                  const Text('Sevimlilar bo\'sh', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  const Text('Kinolar sahifasidan ⭐ belgisini bosing', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                                ],
                              ),
                            )
                          : GridView.builder(
                              padding: const EdgeInsets.all(16),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 0.60,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 16,
                              ),
                              itemCount: _favoriteMovies.length,
                              itemBuilder: (context, index) {
                                final movie = _favoriteMovies[index];
                                return MovieCard(
                                  movie: movie,
                                  width: double.infinity,
                                  height: 200,
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(builder: (context) => MovieDetailScreen(movie: movie)),
                                    );
                                  },
                                );
                              },
                            ),

                      // History Grid
                      _historyMovies.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.history_rounded, color: AppTheme.textMuted, size: 50),
                                  const SizedBox(height: 10),
                                  const Text('Tarix bo\'sh', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  const Text('Siz tomosha qilgan filmlar shu yerda saqlanadi', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                                ],
                              ),
                            )
                          : GridView.builder(
                              padding: const EdgeInsets.all(16),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 0.60,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 16,
                              ),
                              itemCount: _historyMovies.length,
                              itemBuilder: (context, index) {
                                final movie = _historyMovies[index];
                                return MovieCard(
                                  movie: movie,
                                  width: double.infinity,
                                  height: 200,
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(builder: (context) => MovieDetailScreen(movie: movie)),
                                    );
                                  },
                                );
                              },
                            ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
