import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../constants/api_endpoints.dart';
import '../models/movie.dart';
import '../models/episode.dart';
import '../models/short_video.dart';
import '../models/review.dart';
import 'storage_service.dart';

class ApiService {
  static final http.Client _client = http.Client();

  // Fallback demo movies with rich Uzbek translated movies & series
  static final List<Movie> fallbackMovies = [
    Movie(
      code: '477',
      title: 'Gunohkorlar (Sinners 4K)',
      description: 'Gunohkorlar - Hayajonli va shiddatli tarjima kino. Ikki aka-uka o\'zlarining qorong\'u o\'tmishlaridan qochishga intiladi, ammo ularni yangi xavf-xatarlar kutmoqda.',
      genre: 'Jangari',
      poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
      rating: 9.2,
      quality: '4K ULTRA HD',
      year: '2024',
      duration: '2 soat 15 daqiqa',
      views: 24500,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      isVip: false,
      isSeries: false,
    ),
    Movie(
      code: '1001',
      title: 'Titanlar Jangi 2 (Wrath of the Titans)',
      description: 'Persey ma\'budlar va titanlar o\'rtasidagi dahshatli to\'qnashuvda dunyoni saqlab qolishi kerak.',
      genre: 'Sarguzasht',
      poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      rating: 9.4,
      quality: '4K ULTRA HD',
      year: '2024',
      duration: '1 soat 58 daqiqa',
      views: 31200,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      isVip: true,
      isSeries: false,
    ),
    Movie(
      code: '2001',
      title: 'Qashqirlar Makoni: Pistirma (Kurtlar Vadisi)',
      description: 'Polat Alemdar va uning maxsus guruhi davlat ichidagi xiyonatkor to\'dalarga qarshi kurashadi. Ko\'p qismli afsonaviy serial.',
      genre: 'Jangari',
      poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
      rating: 9.7,
      quality: 'FULL HD',
      year: '2024',
      duration: 'Epizodlar',
      views: 89000,
      isVip: false,
      isSeries: true,
      seasons: [
        Season(
          seasonNumber: 1,
          title: '1-Fasl (Pistirma)',
          episodes: [
            Episode(
              id: 'ep_1_1',
              episodeNumber: 1,
              seasonNumber: 1,
              title: '1-Qism: Yangi Reja',
              duration: '48 daq',
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
            ),
            Episode(
              id: 'ep_1_2',
              episodeNumber: 2,
              seasonNumber: 1,
              title: '2-Qism: Kutilmagan Hujum',
              duration: '52 daq',
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
              poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
            ),
            Episode(
              id: 'ep_1_3',
              episodeNumber: 3,
              seasonNumber: 1,
              title: '3-Qism: Maxfiy Operatsiya',
              duration: '50 daq',
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
              poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
              isVip: true,
            ),
            Episode(
              id: 'ep_1_4',
              episodeNumber: 4,
              seasonNumber: 1,
              title: '4-Qism: Hal qiluvchi Jang',
              duration: '55 daq',
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
              poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
              isVip: true,
            ),
          ],
        ),
      ],
    ),
    Movie(
      code: '1008',
      title: 'Inson G\'azabi (Wrath of Man)',
      description: 'Mister X inkassatorlik kompaniyasiga ishga kirib, millionlab dollarlarni o\'g\'irlagan va o\'g\'lini o\'ldirgan to\'dani birma-bir jazolaydi.',
      genre: 'Jangari',
      poster: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
      rating: 9.5,
      quality: '4K ULTRA HD',
      year: '2024',
      duration: '1 soat 59 daqiqa',
      views: 45000,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      isVip: false,
      isSeries: false,
    ),
    Movie(
      code: '484',
      title: 'Oshkoralik Kuni',
      description: 'Oshkoralik kuni - Sirli va dramatik voqealar rivojiga boy o\'zbek tilidagi tarjima kino.',
      genre: 'Melodrama',
      poster: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80',
      rating: 8.9,
      quality: 'FULL HD',
      year: '2024',
      duration: '1 soat 40 daqiqa',
      views: 19800,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      isVip: false,
      isSeries: false,
    ),
    Movie(
      code: '1005',
      title: 'Devlarni Yenggan Jek',
      description: 'Insaniyat va devlar dunyosi o\'rtasidagi qadimiy afsonaviy urush.',
      genre: 'Multfilm',
      poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
      rating: 8.8,
      quality: 'FULL HD',
      year: '2024',
      duration: '1 soat 35 daqiqa',
      views: 16400,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      isVip: false,
      isSeries: false,
    ),
  ];

  // Fetch Movies
  static Future<List<Movie>> fetchMovies() async {
    try {
      final response = await _client.get(
        Uri.parse(ApiEndpoints.publicMovies),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        if (data.isNotEmpty) {
          List<Movie> list = data
              .map((item) => Movie.fromJson(Map<String, dynamic>.from(item)))
              .toList();
          return list;
        }
      }
    } catch (e) {
      debugPrint('Fetch movies fallback: $e');
    }
    return fallbackMovies;
  }

  // Fetch Genres
  static Future<List<String>> fetchGenres() async {
    try {
      final response = await _client.get(
        Uri.parse(ApiEndpoints.publicGenres),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        List<String> genres = ['Barchasi', ...data.map((e) => e.toString())];
        return genres;
      }
    } catch (e) {
      debugPrint('Fetch genres fallback: $e');
    }
    return ['Barchasi', 'Premyeralar', 'Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Sarguzasht', 'Seriallar'];
  }

  // Fetch Shorts
  static Future<List<ShortVideo>> fetchShorts() async {
    try {
      final response = await _client.get(
        Uri.parse(ApiEndpoints.publicShorts),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body);
        if (body['shorts'] != null && body['shorts'] is List) {
          return (body['shorts'] as List)
              .map((s) => ShortVideo.fromJson(Map<String, dynamic>.from(s)))
              .toList();
        }
      }
    } catch (e) {
      debugPrint('Fetch shorts fallback: $e');
    }

    // Fallback Shorts
    return [
      ShortVideo(
        id: 'short_1',
        title: 'Gunohkorlar — Eng qiziq jang lavhasi 🔥',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
        movieCode: '477',
        movieTitle: 'Gunohkorlar (Sinners 4K)',
        creatorName: 'XitFilm Rasmiy',
        creatorTag: '@xitfilm',
        views: 14200,
        likesCount: 890,
        commentsCount: 42,
      ),
      ShortVideo(
        id: 'short_2',
        title: 'Polat Alemdar qaytmoqda! 🎬',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
        movieCode: '2001',
        movieTitle: 'Qashqirlar Makoni: Pistirma',
        creatorName: 'Kino Olami',
        creatorTag: '@kinoman',
        views: 32000,
        likesCount: 2400,
        commentsCount: 156,
      ),
    ];
  }

  // Fetch Reviews
  static Future<List<Review>> fetchReviews(String code) async {
    try {
      final response = await _client.get(
        Uri.parse(ApiEndpoints.publicReviews(code)),
      ).timeout(const Duration(seconds: 3));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is Map && data['reviews'] != null) {
          return (data['reviews'] as List)
              .map((r) => Review.fromJson(Map<String, dynamic>.from(r)))
              .toList();
        } else if (data is List) {
          return data.map((r) => Review.fromJson(Map<String, dynamic>.from(r))).toList();
        }
      }
    } catch (e) {
      debugPrint('Fetch reviews fallback: $e');
    }

    return [
      Review(
        id: 'rev_1',
        name: 'Sardorbek M.',
        rating: 5.0,
        comment: 'Tarjimasi juda zo\'r chiqqan, ovozlari tushgan. Tavsiya qilaman!',
        date: 'Bugun, 14:20',
      ),
      Review(
        id: 'rev_2',
        name: 'Jasur_99',
        rating: 4.8,
        comment: 'Sifat 4K da umuman qotmasdan ochildi. Rahmat Xit Film!',
        date: 'Kecha, 21:05',
      ),
    ];
  }

  // Add Review
  static Future<bool> addReview(String code, {required String name, required double rating, required String comment}) async {
    try {
      final response = await _client.post(
        Uri.parse(ApiEndpoints.publicReviews(code)),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'rating': rating, 'comment': comment}),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Add review error: $e');
      return false;
    }
  }

  // Apply Promo Code
  static Future<Map<String, dynamic>> applyPromoCode(String promoCode) async {
    try {
      final userId = StorageService.getUserId();
      final response = await _client.post(
        Uri.parse(ApiEndpoints.applyPromo),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId, 'promoCode': promoCode.trim()}),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      debugPrint('Apply promo error: $e');
    }
    
    // Offline promo simulation
    if (promoCode.toUpperCase() == 'XIT2026' || promoCode.toUpperCase() == 'PREMIUM') {
      await StorageService.setVipStatus(true, DateTime.now().add(const Duration(days: 30)));
      return {
        'success': true,
        'message': 'Tabriklaymiz! 30 kunlik VIP obuna faollashtirildi 🎉',
        'days': 30,
      };
    }
    return {'success': false, 'message': 'Promo-kod noto\'g\'ri yoki muddati tugagan!'};
  }

  // Save Playback Progress
  static Future<void> syncPlaybackProgress(String movieCode, int currentSeconds, int totalSeconds, String title, String poster) async {
    try {
      final userId = StorageService.getUserId();
      await _client.post(
        Uri.parse(ApiEndpoints.publicPlaybackProgress),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'code': movieCode,
          'currentTime': currentSeconds,
          'duration': totalSeconds,
          'title': title,
          'poster': poster,
        }),
      );
    } catch (e) {
      debugPrint('Sync playback error: $e');
    }
  }
}
