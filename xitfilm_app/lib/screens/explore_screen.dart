import 'package:flutter/material.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import '../services/api_service.dart';
import '../widgets/movie_card.dart';
import 'movie_detail_screen.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  List<Movie> _allMovies = [];
  List<String> _genres = [];
  String _selectedGenre = 'Barchasi';
  String _searchQuery = '';
  bool _only4K = false;
  bool _onlySeries = false;
  bool _isLoading = true;

  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final movies = await ApiService.fetchMovies();
    final genres = await ApiService.fetchGenres();
    if (mounted) {
      setState(() {
        _allMovies = movies;
        _genres = genres;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Movie> get _filteredMovies {
    return _allMovies.where((m) {
      // Genre filter
      if (_selectedGenre != 'Barchasi' && !m.genre.toLowerCase().contains(_selectedGenre.toLowerCase())) {
        return false;
      }
      // 4K filter
      if (_only4K && !m.quality.contains('4K')) {
        return false;
      }
      // Series filter
      if (_onlySeries && !m.isSeries) {
        return false;
      }
      // Search query filter (by title or code)
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = m.title.toLowerCase().contains(q);
        final matchCode = m.code.toLowerCase().contains(q);
        final matchGenre = m.genre.toLowerCase().contains(q);
        if (!matchTitle && !matchCode && !matchGenre) return false;
      }
      return true;
    }).toList();
  }

  void _showRequestMovieModal() {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Kino Buyurtma Qilish 🎬', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            const Text('Topa olmagan filmingiz yoki serialingiz nomini yozing, tez orada yuklaymiz:', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
            const SizedBox(height: 14),
            TextField(
              controller: titleCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Film nomi (masalan: Avatar 3)',
                hintStyle: const TextStyle(color: AppTheme.textMuted),
                filled: true,
                fillColor: AppTheme.surfaceLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Qo\'shimcha izoh yoki qaysi tilda...',
                hintStyle: const TextStyle(color: AppTheme.textMuted),
                filled: true,
                fillColor: AppTheme.surfaceLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  if (titleCtrl.text.trim().isEmpty) return;
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Buyurtmangiz qabul qilindi! Tez orada yuklanadi.'),
                      backgroundColor: AppTheme.successGreen,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Buyurtma berish', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredMovies;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Katalog va Qidiruv', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_task_rounded, color: AppTheme.cyanAccent),
            tooltip: 'Kino buyurtma qilish',
            onPressed: _showRequestMovieModal,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.cyanAccent))
          : Column(
              children: [
                // Search Input Box
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(color: Colors.white),
                      onChanged: (val) => setState(() => _searchQuery = val),
                      decoration: InputDecoration(
                        hintText: 'Kino nomi, kodi (#477) yoki janri...',
                        hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                        prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.cyanAccent),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, color: AppTheme.textMuted, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ),

                // Genre Filter Chips
                SizedBox(
                  height: 44,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _genres.length,
                    itemBuilder: (context, index) {
                      final g = _genres[index];
                      final isSel = _selectedGenre == g;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(g),
                          selected: isSel,
                          onSelected: (selected) {
                            setState(() => _selectedGenre = g);
                          },
                          backgroundColor: AppTheme.surface,
                          selectedColor: AppTheme.primary,
                          labelStyle: TextStyle(
                            color: isSel ? Colors.white : AppTheme.textSecondary,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                            fontSize: 12,
                          ),
                          side: BorderSide(color: isSel ? AppTheme.primary : AppTheme.borderDark),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      );
                    },
                  ),
                ),

                // Quality & Series quick toggles
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('⚡️ 4K Ultra HD', style: TextStyle(fontSize: 11)),
                        selected: _only4K,
                        onSelected: (val) => setState(() => _only4K = val),
                        backgroundColor: AppTheme.surface,
                        selectedColor: AppTheme.cyanAccent.withAlpha(40),
                        labelStyle: TextStyle(color: _only4K ? AppTheme.cyanAccent : AppTheme.textSecondary),
                        side: BorderSide(color: _only4K ? AppTheme.cyanAccent : AppTheme.borderDark),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('📺 Seriallar', style: TextStyle(fontSize: 11)),
                        selected: _onlySeries,
                        onSelected: (val) => setState(() => _onlySeries = val),
                        backgroundColor: AppTheme.surface,
                        selectedColor: AppTheme.primary.withAlpha(40),
                        labelStyle: TextStyle(color: _onlySeries ? AppTheme.primary : AppTheme.textSecondary),
                        side: BorderSide(color: _onlySeries ? AppTheme.primary : AppTheme.borderDark),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 6),

                // Movies Grid
                Expanded(
                  child: filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.movie_filter_outlined, color: AppTheme.textMuted, size: 60),
                              const SizedBox(height: 12),
                              const Text('Hech narsa topilmadi', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 6),
                              const Text('Boshqa nom yoki kod bilan qidirib ko\'ring', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: _showRequestMovieModal,
                                icon: const Icon(Icons.add, size: 18),
                                label: const Text('Kinoni buyurtma qilish'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.surfaceLight,
                                  foregroundColor: AppTheme.cyanAccent,
                                ),
                              ),
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
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final movie = filtered[index];
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
                ),
              ],
            ),
    );
  }
}
