class Review {
  final String id;
  final String name;
  final double rating;
  final String comment;
  final String date;

  Review({
    required this.id,
    required this.name,
    required this.rating,
    required this.comment,
    required this.date,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    double r = 5.0;
    if (json['rating'] != null) {
      r = (json['rating'] is num) ? (json['rating'] as num).toDouble() : double.tryParse(json['rating'].toString()) ?? 5.0;
    }
    return Review(
      id: json['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      name: json['name'] ?? 'Foydalanuvchi',
      rating: r,
      comment: json['comment'] ?? '',
      date: json['date'] ?? json['createdAt'] ?? 'Yaqinda',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'rating': rating,
      'comment': comment,
      'date': date,
    };
  }
}
