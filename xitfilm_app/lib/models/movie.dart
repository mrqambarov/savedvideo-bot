import '../constants/api_endpoints.dart';
import 'episode.dart';

class Movie {
  final String code;
  final String title;
  final String description;
  final String genre;
  final String poster;
  final String? backdrop;
  final double rating;
  final String quality;
  final String year;
  final String? duration;
  final int views;
  final List<dynamic> likes;
  final List<dynamic> dislikes;
  final String? fileId;
  final String? videoUrl;
  final String? trailerUrl;
  final bool isVip;
  final bool isSeries;
  final List<Season> seasons;
  final String? ageRating;
  final String? country;

  Movie({
    required this.code,
    required this.title,
    required this.description,
    required this.genre,
    required this.poster,
    this.backdrop,
    this.rating = 8.5,
    this.quality = 'FULL HD',
    this.year = '2024',
    this.duration,
    this.views = 0,
    this.likes = const [],
    this.dislikes = const [],
    this.fileId,
    this.videoUrl,
    this.trailerUrl,
    this.isVip = false,
    this.isSeries = false,
    this.seasons = const [],
    this.ageRating = '16+',
    this.country = 'AQSH',
  });

  factory Movie.fromJson(Map<String, dynamic> json) {
    // Parse seasons if present
    List<Season> parsedSeasons = [];
    if (json['seasons'] != null && json['seasons'] is List) {
      parsedSeasons = (json['seasons'] as List)
          .map((s) => Season.fromJson(Map<String, dynamic>.from(s)))
          .toList();
    } else if (json['isSeries'] == true || (json['episodes'] != null && json['episodes'] is List)) {
      // Single season fallback
      var epList = (json['episodes'] as List? ?? [])
          .map((e) => Episode.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      if (epList.isNotEmpty) {
        parsedSeasons.add(Season(seasonNumber: 1, title: '1-Fasl', episodes: epList));
      }
    }

    double parsedRating = 8.5;
    if (json['rating'] != null) {
      if (json['rating'] is num) {
        parsedRating = (json['rating'] as num).toDouble();
      } else {
        parsedRating = double.tryParse(json['rating'].toString()) ?? 8.5;
      }
    }

    int parsedViews = 0;
    if (json['views'] != null) {
      if (json['views'] is int) {
        parsedViews = json['views'];
      } else {
        parsedViews = int.tryParse(json['views'].toString()) ?? 0;
      }
    }

    final rawPoster = json['poster']?.toString();
    final rawBackdrop = (json['backdrop'] ?? json['poster'])?.toString();
    final rawVideo = (json['videoUrl'] ?? json['streamUrl'] ?? json['url'])?.toString();

    return Movie(
      code: json['code']?.toString() ?? '',
      title: json['title'] ?? 'Noma\'lum Film',
      description: json['description'] ?? 'Ushbu film haqida batafsil ma\'lumot tez kunda.',
      genre: json['genre'] ?? 'Jangari',
      poster: ApiEndpoints.formatPosterUrl(rawPoster),
      backdrop: ApiEndpoints.formatPosterUrl(rawBackdrop),
      rating: parsedRating,
      quality: json['quality'] ?? 'FULL HD',
      year: json['year']?.toString() ?? '2024',
      duration: json['duration'] ?? '1 soat 45 daqiqa',
      views: parsedViews,
      likes: json['likes'] is List ? json['likes'] : [],
      dislikes: json['dislikes'] is List ? json['dislikes'] : [],
      fileId: json['fileId']?.toString(),
      videoUrl: ApiEndpoints.formatMediaUrl(rawVideo),
      trailerUrl: json['trailerUrl']?.toString(),
      isVip: json['isVip'] == true || json['vip'] == true,
      isSeries: json['isSeries'] == true || parsedSeasons.isNotEmpty,
      seasons: parsedSeasons,
      ageRating: json['ageRating'] ?? '16+',
      country: json['country'] ?? 'AQSH',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'title': title,
      'description': description,
      'genre': genre,
      'poster': poster,
      'backdrop': backdrop,
      'rating': rating,
      'quality': quality,
      'year': year,
      'duration': duration,
      'views': views,
      'likes': likes,
      'dislikes': dislikes,
      'fileId': fileId,
      'videoUrl': videoUrl,
      'trailerUrl': trailerUrl,
      'isVip': isVip,
      'isSeries': isSeries,
      'seasons': seasons.map((s) => s.toJson()).toList(),
      'ageRating': ageRating,
      'country': country,
    };
  }
}
