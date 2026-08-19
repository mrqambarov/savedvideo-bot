class ApiEndpoints {
  // Base URLs
  static const String siteBaseUrl = 'https://xitfilm.uz';
  static const String productionBaseUrl = 'https://xitfilm.uz/movies/api';
  static const String fallbackBaseUrl = 'https://xitfilm.uz/api';
  
  // For local testing (Android Emulator uses 10.0.2.2, real device uses PC IP)
  static const String localBaseUrl = 'http://10.0.2.2:5001/api';
  
  static String baseUrl = productionBaseUrl;

  // Bot Information
  static const String botUsername = 'xitfilm_bot';
  static const String telegramChannelUrl = 'https://t.me/xitfilm_uz';
  static const String sponsorChannelUsername = '@xitfilm_uz';

  // Endpoints
  static String get publicMovies => '$baseUrl/public-movies';
  static String get publicGenres => '$baseUrl/public-genres';
  static String get publicShorts => '$baseUrl/public-shorts';
  static String get publicRequest => '$baseUrl/public-request';
  static String publicReviews(String code) => '$baseUrl/public-reviews/$code';
  static String publicUserData(String userId) => '$baseUrl/public-user-data/$userId';
  static String get publicSync => '$baseUrl/public-sync';
  static String get publicToggleFav => '$baseUrl/public-toggle-fav';
  static String get publicPlaybackProgress => '$baseUrl/public-playback-progress';
  static String getPlaybackProgress(String userId) => '$baseUrl/public-playback-progress/$userId';
  static String get upgradeVip => '$baseUrl/public-upgrade-vip';
  static String get applyPromo => '$baseUrl/public-apply-promo';
  static String get verifyAuthCode => '$baseUrl/public-verify-code';

  // Helper to format any relative media URL from database (e.g. /uploads/shorts/...)
  static String formatMediaUrl(String? url, {String defaultFallback = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}) {
    if (url == null || url.trim().isEmpty) {
      return defaultFallback;
    }
    final clean = url.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    if (clean.startsWith('/')) {
      return '$siteBaseUrl$clean';
    }
    return '$siteBaseUrl/$clean';
  }

  // Helper for poster images
  static String formatPosterUrl(String? url, {String defaultFallback = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80'}) {
    if (url == null || url.trim().isEmpty) {
      return defaultFallback;
    }
    final clean = url.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    if (clean.startsWith('/')) {
      return '$siteBaseUrl$clean';
    }
    return '$siteBaseUrl/$clean';
  }
}
