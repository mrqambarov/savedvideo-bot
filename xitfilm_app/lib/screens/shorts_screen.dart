import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../constants/app_theme.dart';
import '../models/short_video.dart';
import '../services/api_service.dart';
import 'movie_detail_screen.dart';

class ShortsScreen extends StatefulWidget {
  const ShortsScreen({super.key});

  @override
  State<ShortsScreen> createState() => _ShortsScreenState();
}

class _ShortsScreenState extends State<ShortsScreen> {
  List<ShortVideo> _shorts = [];
  bool _isLoading = true;
  int _currentIndex = 0;
  final PageController _pageController = PageController();

  @override
  void initState() {
    super.initState();
    _loadShorts();
  }

  Future<void> _loadShorts() async {
    final list = await ApiService.fetchShorts();
    if (mounted) {
      setState(() {
        _shorts = list;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: AppTheme.cyanAccent)),
      );
    }

    if (_shorts.isEmpty) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: Text('Shorts lavhalar mavjud emas', style: TextStyle(color: Colors.white))),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: PageView.builder(
        controller: _pageController,
        scrollDirection: Axis.vertical,
        itemCount: _shorts.length,
        onPageChanged: (index) {
          setState(() => _currentIndex = index);
        },
        itemBuilder: (context, index) {
          final short = _shorts[index];
          return SingleShortItem(
            short: short,
            isActive: index == _currentIndex,
          );
        },
      ),
    );
  }
}

class SingleShortItem extends StatefulWidget {
  final ShortVideo short;
  final bool isActive;

  const SingleShortItem({
    super.key,
    required this.short,
    required this.isActive,
  });

  @override
  State<SingleShortItem> createState() => _SingleShortItemState();
}

class _SingleShortItemState extends State<SingleShortItem> {
  VideoPlayerController? _controller;
  bool _isLiked = false;
  int _likesCount = 0;

  @override
  void initState() {
    super.initState();
    _isLiked = widget.short.isLiked;
    _likesCount = widget.short.likesCount;
    _initVideo();
  }

  Future<void> _initVideo() async {
    try {
      _controller = VideoPlayerController.networkUrl(Uri.parse(widget.short.videoUrl));
      await _controller!.initialize();
      _controller!.setLooping(true);
      if (widget.isActive) {
        _controller!.play();
      }
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('Short video init error on ${widget.short.videoUrl}: $e');
      try {
        _controller = VideoPlayerController.networkUrl(
          Uri.parse('https://media.w3.org/2010/05/sintel/trailer.mp4'),
        );
        await _controller!.initialize();
        _controller!.setLooping(true);
        if (widget.isActive) {
          _controller!.play();
        }
        if (mounted) setState(() {});
      } catch (err) {
        debugPrint('Fallback short video error: $err');
      }
    }
  }

  @override
  void didUpdateWidget(SingleShortItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        _controller?.play();
      } else {
        _controller?.pause();
      }
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _toggleLike() {
    setState(() {
      _isLiked = !_isLiked;
      _likesCount += _isLiked ? 1 : -1;
    });
  }

  void _goToFullMovie() async {
    final movies = await ApiService.fetchMovies();
    final movie = movies.firstWhere(
      (m) => m.code == widget.short.movieCode,
      orElse: () => ApiService.fallbackMovies[0],
    );
    if (mounted) {
      _controller?.pause();
      Navigator.of(context).push(
        MaterialPageRoute(builder: (context) => MovieDetailScreen(movie: movie)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Video
        if (_controller != null && _controller!.value.isInitialized)
          GestureDetector(
            onTap: () {
              if (_controller!.value.isPlaying) {
                _controller!.pause();
              } else {
                _controller!.play();
              }
              setState(() {});
            },
            child: Center(
              child: AspectRatio(
                aspectRatio: _controller!.value.aspectRatio,
                child: VideoPlayer(_controller!),
              ),
            ),
          )
        else
          Container(
            color: Colors.black,
            child: const Center(child: CircularProgressIndicator(color: AppTheme.cyanAccent)),
          ),

        // Gradient Shadow
        Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withAlpha(80),
                  Colors.transparent,
                  Colors.black.withAlpha(200),
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
          ),
        ),

        // Right Actions (Like, Comment, Share, Sound)
        Positioned(
          bottom: 40,
          right: 12,
          child: Column(
            children: [
              // Like
              GestureDetector(
                onTap: _toggleLike,
                child: Column(
                  children: [
                    Icon(
                      _isLiked ? Icons.favorite_rounded : Icons.favorite_outline_rounded,
                      color: _isLiked ? AppTheme.primary : Colors.white,
                      size: 36,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$_likesCount',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Comments
              Column(
                children: [
                  const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white, size: 32),
                  const SizedBox(height: 4),
                  Text(
                    '${widget.short.commentsCount}',
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Share
              const Column(
                children: [
                  Icon(Icons.share_rounded, color: Colors.white, size: 30),
                  SizedBox(height: 4),
                  Text('Ulashish', style: TextStyle(color: Colors.white, fontSize: 11)),
                ],
              ),
            ],
          ),
        ),

        // Bottom Info & Full Movie CTA
        Positioned(
          bottom: 24,
          left: 16,
          right: 75,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Creator tag
              Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: AppTheme.primary,
                    child: const Text('🎬', style: TextStyle(fontSize: 12)),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    widget.short.creatorTag,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // Title
              Text(
                widget.short.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.3),
              ),

              const SizedBox(height: 12),

              // Watch Full Movie CTA Button
              GestureDetector(
                onTap: _goToFullMovie,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(color: AppTheme.primary.withAlpha(140), blurRadius: 10),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 18),
                      const SizedBox(width: 6),
                      Text(
                        'To\'liq filmni ko\'rish (#${widget.short.movieCode})',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
