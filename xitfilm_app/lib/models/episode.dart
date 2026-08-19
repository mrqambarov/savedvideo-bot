import '../constants/api_endpoints.dart';

class Episode {
  final String id;
  final int episodeNumber;
  final int seasonNumber;
  final String title;
  final String? description;
  final String? duration;
  final String? videoUrl;
  final String? fileId;
  final String? poster;
  final bool isVip;

  Episode({
    required this.id,
    required this.episodeNumber,
    this.seasonNumber = 1,
    required this.title,
    this.description,
    this.duration,
    this.videoUrl,
    this.fileId,
    this.poster,
    this.isVip = false,
  });

  factory Episode.fromJson(Map<String, dynamic> json) {
    final rawVideo = json['videoUrl'] ?? json['url'];
    final rawPoster = json['poster'];

    return Episode(
      id: json['id']?.toString() ?? '',
      episodeNumber: json['episodeNumber'] is int 
          ? json['episodeNumber'] 
          : int.tryParse(json['episodeNumber']?.toString() ?? '1') ?? 1,
      seasonNumber: json['seasonNumber'] is int 
          ? json['seasonNumber'] 
          : int.tryParse(json['seasonNumber']?.toString() ?? '1') ?? 1,
      title: json['title'] ?? 'Qism ${json['episodeNumber'] ?? 1}',
      description: json['description'],
      duration: json['duration'],
      videoUrl: ApiEndpoints.formatMediaUrl(rawVideo?.toString()),
      fileId: json['fileId']?.toString(),
      poster: rawPoster != null && rawPoster.toString().isNotEmpty 
          ? ApiEndpoints.formatPosterUrl(rawPoster.toString()) 
          : null,
      isVip: json['isVip'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'episodeNumber': episodeNumber,
      'seasonNumber': seasonNumber,
      'title': title,
      'description': description,
      'duration': duration,
      'videoUrl': videoUrl,
      'fileId': fileId,
      'poster': poster,
      'isVip': isVip,
    };
  }
}

class Season {
  final int seasonNumber;
  final String title;
  final List<Episode> episodes;

  Season({
    required this.seasonNumber,
    required this.title,
    required this.episodes,
  });

  factory Season.fromJson(Map<String, dynamic> json) {
    var rawEpisodes = json['episodes'] as List? ?? [];
    List<Episode> parsedEpisodes = rawEpisodes
        .map((e) => Episode.fromJson(Map<String, dynamic>.from(e)))
        .toList();

    return Season(
      seasonNumber: json['seasonNumber'] is int 
          ? json['seasonNumber'] 
          : int.tryParse(json['seasonNumber']?.toString() ?? '1') ?? 1,
      title: json['title'] ?? '${json['seasonNumber'] ?? 1}-Fasl',
      episodes: parsedEpisodes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'seasonNumber': seasonNumber,
      'title': title,
      'episodes': episodes.map((e) => e.toJson()).toList(),
    };
  }
}
