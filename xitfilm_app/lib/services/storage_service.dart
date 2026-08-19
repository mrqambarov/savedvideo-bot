import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const String _keyUserId = 'xitfilm_user_id';
  static const String _keyIsVip = 'xitfilm_is_vip';
  static const String _keyVipExpiry = 'xitfilm_vip_expiry';
  static const String _keyFavorites = 'xitfilm_favorites';
  static const String _keyHistory = 'xitfilm_history';
  static const String _keyProgress = 'xitfilm_progress';

  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  static SharedPreferences get prefs {
    if (_prefs == null) {
      throw Exception('StorageService not initialized! Call StorageService.init() first.');
    }
    return _prefs!;
  }

  // User ID
  static String getUserId() {
    String? id = prefs.getString(_keyUserId);
    if (id == null || id.isEmpty) {
      id = 'user_${DateTime.now().millisecondsSinceEpoch}_${(1000 + (DateTime.now().microsecond % 9000))}';
      prefs.setString(_keyUserId, id);
    }
    return id;
  }

  static Future<void> setUserId(String id) async {
    await prefs.setString(_keyUserId, id);
  }

  // VIP Status
  static bool isVip() {
    bool vip = prefs.getBool(_keyIsVip) ?? false;
    if (vip) {
      int? expiry = prefs.getInt(_keyVipExpiry);
      if (expiry != null && DateTime.now().millisecondsSinceEpoch > expiry) {
        setVipStatus(false, null);
        return false;
      }
    }
    return vip;
  }

  static Future<void> setVipStatus(bool isVip, DateTime? expiry) async {
    await prefs.setBool(_keyIsVip, isVip);
    if (expiry != null) {
      await prefs.setInt(_keyVipExpiry, expiry.millisecondsSinceEpoch);
    } else {
      await prefs.remove(_keyVipExpiry);
    }
  }

  static DateTime? getVipExpiryDate() {
    int? expiry = prefs.getInt(_keyVipExpiry);
    if (expiry == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(expiry);
  }

  // Favorites
  static List<String> getFavorites() {
    return prefs.getStringList(_keyFavorites) ?? [];
  }

  static Future<bool> toggleFavorite(String movieCode) async {
    List<String> list = getFavorites();
    bool added = false;
    if (list.contains(movieCode)) {
      list.remove(movieCode);
    } else {
      list.insert(0, movieCode);
      added = true;
    }
    await prefs.setStringList(_keyFavorites, list);
    return added;
  }

  static bool isFavorite(String movieCode) {
    return getFavorites().contains(movieCode);
  }

  // Watch History
  static List<String> getHistory() {
    return prefs.getStringList(_keyHistory) ?? [];
  }

  static Future<void> addToHistory(String movieCode) async {
    List<String> list = getHistory();
    list.remove(movieCode);
    list.insert(0, movieCode);
    if (list.length > 50) list = list.sublist(0, 50);
    await prefs.setStringList(_keyHistory, list);
  }

  // Playback Progress (Continue Watching)
  static Map<String, dynamic> getAllProgress() {
    String? raw = prefs.getString(_keyProgress);
    if (raw == null) return {};
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (e) {
      return {};
    }
  }

  static Map<String, dynamic>? getMovieProgress(String movieCode) {
    var all = getAllProgress();
    if (all.containsKey(movieCode)) {
      return Map<String, dynamic>.from(all[movieCode]);
    }
    return null;
  }

  static Future<void> saveProgress(
    String movieCode, {
    required int currentSeconds,
    required int totalSeconds,
    required String title,
    required String poster,
    int? episodeNumber,
  }) async {
    var all = getAllProgress();
    all[movieCode] = {
      'code': movieCode,
      'currentSeconds': currentSeconds,
      'totalSeconds': totalSeconds,
      'title': title,
      'poster': poster,
      'episodeNumber': episodeNumber,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    };
    await prefs.setString(_keyProgress, jsonEncode(all));
    await addToHistory(movieCode);
  }
}
