import 'package:url_launcher/url_launcher.dart';
import '../constants/api_endpoints.dart';

class TelegramService {
  // Open Movie in Telegram Bot for direct download
  static Future<bool> openMovieInBot(String movieCode) async {
    final startParam = 'movie_$movieCode';
    final tgAppUri = Uri.parse('tg://resolve?domain=${ApiEndpoints.botUsername}&start=$startParam');
    final webUri = Uri.parse('https://t.me/${ApiEndpoints.botUsername}?start=$startParam');

    try {
      if (await canLaunchUrl(tgAppUri)) {
        return await launchUrl(tgAppUri, mode: LaunchMode.externalApplication);
      } else {
        return await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      try {
        return await launchUrl(webUri, mode: LaunchMode.externalApplication);
      } catch (err) {
        return false;
      }
    }
  }

  // Open Telegram Channel for mandatory subscription
  static Future<bool> openChannel({String? url}) async {
    final target = url ?? ApiEndpoints.telegramChannelUrl;
    final uri = Uri.parse(target);
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      return false;
    }
  }
}
