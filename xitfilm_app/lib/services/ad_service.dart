import 'storage_service.dart';

class VideoAdItem {
  final String id;
  final String title;
  final String sponsorName;
  final String sponsorTag;
  final String videoUrl;
  final String ctaUrl;
  final String ctaText;
  final int skipAfterSeconds;

  VideoAdItem({
    required this.id,
    required this.title,
    required this.sponsorName,
    this.sponsorTag = 'Homiy Reklamasi',
    required this.videoUrl,
    required this.ctaUrl,
    this.ctaText = 'Batafsil ma\'lumot',
    this.skipAfterSeconds = 5,
  });
}

class AdService {
  static final List<VideoAdItem> samplePreRollAds = [
    VideoAdItem(
      id: 'ad_vip_promo',
      title: 'XIT FILM VIP Premium obunasi',
      sponsorName: 'XitFilm Rasmiy',
      sponsorTag: 'Maxsus Taklif',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      ctaUrl: 'https://xitfilm.uz/vip',
      ctaText: 'VIP Obunani Faollashtirish',
      skipAfterSeconds: 5,
    ),
    VideoAdItem(
      id: 'ad_bot_promo',
      title: 'XitFilm Telegram Boti — Filmlarni yuklab oling!',
      sponsorName: '@xitfilm_bot',
      sponsorTag: 'Telegram Hamkor',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      ctaUrl: 'https://t.me/xitfilm_bot',
      ctaText: 'Botga O\'tish',
      skipAfterSeconds: 5,
    ),
  ];

  static bool shouldShowAds() {
    return !StorageService.isVip();
  }

  static VideoAdItem getRandomPreRollAd() {
    samplePreRollAds.shuffle();
    return samplePreRollAds.first;
  }
}
