import '../constants/api_endpoints.dart';

class ShortVideo {
  final String id;
  final String title;
  final String? description;
  final String videoUrl;
  final String? poster;
  final String movieCode;
  final String movieTitle;
  final String creatorName;
  final String creatorTag;
  final int views;
  final int likesCount;
  final int commentsCount;
  bool isLiked;
  bool isBookmarked;

  ShortVideo({
    required this.id,
    required this.title,
    this.description,
    required this.videoUrl,
    this.poster,
    required this.movieCode,
    required this.movieTitle,
    this.creatorName = 'XitFilm Creator',
    this.creatorTag = '@xitfilm_uz',
    this.views = 0,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.isLiked = false,
    this.isBookmarked = false,
  });

  factory ShortVideo.fromJson(Map<String, dynamic> json) {
    final rawVideo = json['videoUrl'] ?? json['url'] ?? '';
    final rawPoster = json['poster'];

    return ShortVideo(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? 'Premyera Lavha',
      description: json['description'],
      videoUrl: ApiEndpoints.formatMediaUrl(rawVideo?.toString()),
      poster: rawPoster != null && rawPoster.toString().isNotEmpty 
          ? ApiEndpoints.formatPosterUrl(rawPoster.toString()) 
          : null,
      movieCode: json['movieCode']?.toString() ?? '',
      movieTitle: json['movieTitle'] ?? 'Kino',
      creatorName: json['creatorName'] ?? 'XIT FILM Official',
      creatorTag: json['creatorTag'] ?? '@xitfilm_uz',
      views: json['views'] is int ? json['views'] : int.tryParse(json['views']?.toString() ?? '0') ?? 0,
      likesCount: json['likesCount'] is int 
          ? json['likesCount'] 
          : (json['likes'] is List ? (json['likes'] as List).length : 0),
      commentsCount: json['commentsCount'] is int ? json['commentsCount'] : 0,
      isLiked: json['isLiked'] == true,
      isBookmarked: json['isBookmarked'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'videoUrl': videoUrl,
      'poster': poster,
      'movieCode': movieCode,
      'movieTitle': movieTitle,
      'creatorName': creatorName,
      'creatorTag': creatorTag,
      'views': views,
      'likesCount': likesCount,
      'commentsCount': commentsCount,
      'isLiked': isLiked,
      'isBookmarked': isBookmarked,
    };
  }
}
