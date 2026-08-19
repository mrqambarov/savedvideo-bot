import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import '../constants/app_theme.dart';
import '../models/movie.dart';
import '../models/episode.dart';
import '../services/ad_service.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import 'ad_overlay_widget.dart';

class CustomVideoPlayer extends StatefulWidget {
  final Movie movie;
  final Episode? episode;
  final VoidCallback? onNextEpisode;
  final VoidCallback onGoToVip;

  const CustomVideoPlayer({
    super.key,
    required this.movie,
    this.episode,
    this.onNextEpisode,
    required this.onGoToVip,
  });

  @override
  State<CustomVideoPlayer> createState() => _CustomVideoPlayerState();
}

class _CustomVideoPlayerState extends State<CustomVideoPlayer> {
  VideoPlayerController? _controller;
  bool _isPlayingAd = false;
  VideoAdItem? _currentAd;
  bool _showControls = true;
  Timer? _hideControlsTimer;
  Timer? _progressSaveTimer;
  
  double _playbackSpeed = 1.0;
  String _selectedQuality = '1080p Full HD';
  bool _isFullscreen = false;

  final List<String> _qualities = ['4K Ultra HD', '1080p Full HD', '720p HD', '480p SD'];
  final List<double> _speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    // Check if we should play pre-roll ad
    if (AdService.shouldShowAds()) {
      _isPlayingAd = true;
      _currentAd = AdService.getRandomPreRollAd();
      await _initializeVideo(_currentAd!.videoUrl, isAd: true);
    } else {
      await _loadMainMovie();
    }
  }

  Future<void> _loadMainMovie() async {
    _isPlayingAd = false;
    String videoUrl = widget.episode?.videoUrl ?? widget.movie.videoUrl ?? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    await _initializeVideo(videoUrl, isAd: false);

    // Resume playback if progress exists
    final saved = StorageService.getMovieProgress(widget.movie.code);
    if (saved != null && saved['currentSeconds'] != null) {
      final currentSec = saved['currentSeconds'] as int;
      if (currentSec > 10 && _controller != null) {
        _controller!.seekTo(Duration(seconds: currentSec));
      }
    }

    _startProgressSaving();
  }

  Future<void> _initializeVideo(String url, {required bool isAd}) async {
    await _controller?.dispose();
    try {
      _controller = VideoPlayerController.networkUrl(Uri.parse(url));
      await _controller!.initialize();
      _controller!.setPlaybackSpeed(_playbackSpeed);
      _controller!.play();
      _controller!.addListener(_videoListener);
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('Video player init error on $url: $e');
      if (!isAd) {
        try {
          _controller = VideoPlayerController.networkUrl(
            Uri.parse('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'),
          );
          await _controller!.initialize();
          _controller!.setPlaybackSpeed(_playbackSpeed);
          _controller!.play();
          _controller!.addListener(_videoListener);
          if (mounted) setState(() {});
        } catch (err) {
          debugPrint('Fallback video init error: $err');
        }
      }
    }
  }

  void _videoListener() {
    if (_controller == null) return;
    if (_controller!.value.position >= _controller!.value.duration && _controller!.value.duration > Duration.zero) {
      if (_isPlayingAd) {
        _skipAd();
      } else if (widget.onNextEpisode != null) {
        widget.onNextEpisode!();
      }
    }
    setState(() {});
  }

  void _startProgressSaving() {
    _progressSaveTimer?.cancel();
    _progressSaveTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (_controller != null && _controller!.value.isPlaying && !_isPlayingAd) {
        final pos = _controller!.value.position.inSeconds;
        final dur = _controller!.value.duration.inSeconds;
        if (dur > 0) {
          StorageService.saveProgress(
            widget.movie.code,
            currentSeconds: pos,
            totalSeconds: dur,
            title: widget.movie.title,
            poster: widget.movie.poster,
            episodeNumber: widget.episode?.episodeNumber,
          );
          ApiService.syncPlaybackProgress(
            widget.movie.code,
            pos,
            dur,
            widget.movie.title,
            widget.movie.poster,
          );
        }
      }
    });
  }

  void _skipAd() {
    _loadMainMovie();
  }

  void _togglePlayPause() {
    if (_controller == null) return;
    if (_controller!.value.isPlaying) {
      _controller!.pause();
      _showControlsTemporarily(permanent: true);
    } else {
      _controller!.play();
      _showControlsTemporarily();
    }
  }

  void _seekRelative(int seconds) {
    if (_controller == null) return;
    final target = _controller!.value.position + Duration(seconds: seconds);
    _controller!.seekTo(target);
    _showControlsTemporarily();
  }

  void _showControlsTemporarily({bool permanent = false}) {
    setState(() => _showControls = true);
    _hideControlsTimer?.cancel();
    if (!permanent) {
      _hideControlsTimer = Timer(const Duration(seconds: 4), () {
        if (mounted && (_controller?.value.isPlaying ?? false)) {
          setState(() => _showControls = false);
        }
      });
    }
  }

  void _toggleFullscreen() {
    setState(() {
      _isFullscreen = !_isFullscreen;
    });
    if (_isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
      ]);
    }
  }

  void _showQualityModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Video Sifatini Tanlang',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ..._qualities.map((q) => ListTile(
              title: Text(q, style: TextStyle(color: _selectedQuality == q ? AppTheme.cyanAccent : Colors.white)),
              trailing: _selectedQuality == q ? const Icon(Icons.check_circle, color: AppTheme.cyanAccent) : null,
              onTap: () {
                setState(() => _selectedQuality = q);
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Sifat: $q ga o\'zgartirildi'), backgroundColor: AppTheme.surfaceLight),
                );
              },
            )),
          ],
        ),
      ),
    );
  }

  void _showSpeedModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ijro Tezligini Tanlang',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ..._speeds.map((s) => ListTile(
              title: Text('${s}x ${s == 1.0 ? "(Oddiy)" : ""}', style: TextStyle(color: _playbackSpeed == s ? AppTheme.cyanAccent : Colors.white)),
              trailing: _playbackSpeed == s ? const Icon(Icons.check_circle, color: AppTheme.cyanAccent) : null,
              onTap: () {
                setState(() => _playbackSpeed = s);
                _controller?.setPlaybackSpeed(s);
                Navigator.pop(context);
              },
            )),
          ],
        ),
      ),
    );
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (d.inHours > 0) {
      return '${d.inHours}:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  @override
  void dispose() {
    _hideControlsTimer?.cancel();
    _progressSaveTimer?.cancel();
    _controller?.removeListener(_videoListener);
    _controller?.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: Colors.black,
          child: const Center(
            child: CircularProgressIndicator(color: AppTheme.cyanAccent),
          ),
        ),
      );
    }

    return AspectRatio(
      aspectRatio: _isFullscreen ? MediaQuery.of(context).size.aspectRatio : 16 / 9,
      child: GestureDetector(
        onTap: () => _showControlsTemporarily(),
        child: Container(
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Video Surface
              Center(
                child: AspectRatio(
                  aspectRatio: _controller!.value.aspectRatio,
                  child: VideoPlayer(_controller!),
                ),
              ),

              // Double Tap Gesture Areas
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onDoubleTap: () => _seekRelative(-10),
                      child: Container(),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onDoubleTap: () => _seekRelative(10),
                      child: Container(),
                    ),
                  ),
                ],
              ),

              // Ad Overlay if Playing Pre-roll
              if (_isPlayingAd && _currentAd != null)
                AdOverlayWidget(
                  ad: _currentAd!,
                  onAdFinished: _skipAd,
                  onGoToVip: widget.onGoToVip,
                ),

              // Custom Player Controls (If not ad and controls active)
              if (!_isPlayingAd && _showControls)
                Container(
                  color: Colors.black.withAlpha(120),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Top Bar
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                widget.episode != null
                                    ? '${widget.movie.title} • ${widget.episode!.title}'
                                    : widget.movie.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.speed_rounded, color: Colors.white, size: 20),
                              onPressed: _showSpeedModal,
                            ),
                            IconButton(
                              icon: const Icon(Icons.high_quality_rounded, color: Colors.white, size: 20),
                              onPressed: _showQualityModal,
                            ),
                          ],
                        ),
                      ),

                      // Center Play/Pause & Seek Buttons
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 36),
                            onPressed: () => _seekRelative(-10),
                          ),
                          const SizedBox(width: 24),
                          Container(
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.primary.withAlpha(150),
                                  blurRadius: 16,
                                ),
                              ],
                            ),
                            child: IconButton(
                              icon: Icon(
                                _controller!.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                color: Colors.white,
                                size: 38,
                              ),
                              onPressed: _togglePlayPause,
                            ),
                          ),
                          const SizedBox(width: 24),
                          IconButton(
                            icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 36),
                            onPressed: () => _seekRelative(10),
                          ),
                        ],
                      ),

                      // Bottom Progress Slider & Fullscreen
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        child: Row(
                          children: [
                            Text(
                              _formatDuration(_controller!.value.position),
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                            Expanded(
                              child: SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  trackHeight: 3.5,
                                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                  activeTrackColor: AppTheme.primary,
                                  inactiveTrackColor: Colors.white.withAlpha(80),
                                  thumbColor: AppTheme.cyanAccent,
                                ),
                                child: Slider(
                                  value: _controller!.value.position.inMilliseconds.toDouble().clamp(
                                    0.0,
                                    _controller!.value.duration.inMilliseconds.toDouble(),
                                  ),
                                  max: _controller!.value.duration.inMilliseconds.toDouble(),
                                  onChanged: (val) {
                                    _controller!.seekTo(Duration(milliseconds: val.toInt()));
                                  },
                                ),
                              ),
                            ),
                            Text(
                              _formatDuration(_controller!.value.duration),
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(width: 6),
                            IconButton(
                              icon: Icon(
                                _isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                                color: Colors.white,
                                size: 24,
                              ),
                              onPressed: _toggleFullscreen,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
