import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Palette (XIT FILM Official Violet & Cyber Cyan Theme)
  static const Color background = Color(0xFF06070A);
  static const Color surface = Color(0xFF0E101A);
  static const Color surfaceLight = Color(0xFF161A2A);
  static const Color cardColor = Color(0xFF101322);
  
  static const Color primary = Color(0xFF8B5CF6); // Official Royal Violet / Purple
  static const Color primaryDark = Color(0xFF6D28D9); // Deep Purple
  static const Color primaryLight = Color(0xFFA78BFA); // Soft Lavender Violet
  static const Color cyanAccent = Color(0xFF00F2FE); // Electric Cyan / Neon Blue
  static const Color cyanDark = Color(0xFF06B6D4);
  static const Color goldAccent = Color(0xFFFFB703); // VIP Gold / Amber
  static const Color successGreen = Color(0xFF00E676);
  static const Color errorRed = Color(0xFFFF3366);
  
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  
  static const Color borderDark = Color(0xFF1E2338);
  static const Color borderGlow = Color(0x4D8B5CF6);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient electricVioletCyanGradient = LinearGradient(
    colors: [Color(0xFF8B5CF6), Color(0xFF00F2FE)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cyanGradient = LinearGradient(
    colors: [Color(0xFF00F2FE), Color(0xFF4FACFE)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient vipGoldGradient = LinearGradient(
    colors: [Color(0xFFFFD700), Color(0xFFFF9900)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient darkOverlayGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.transparent,
      Color(0x8006070A),
      Color(0xF006070A),
      Color(0xFF06070A),
    ],
    stops: [0.0, 0.4, 0.75, 1.0],
  );

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      cardColor: cardColor,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: cyanAccent,
        surface: surface,
        onPrimary: Colors.white,
        onSecondary: Colors.black,
        onSurface: textPrimary,
      ),
      textTheme: GoogleFonts.outfitTextTheme(
        ThemeData.dark().textTheme.copyWith(
          displayLarge: const TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
          titleLarge: const TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
          titleMedium: const TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
          bodyLarge: const TextStyle(color: textPrimary),
          bodyMedium: const TextStyle(color: textSecondary),
          bodySmall: const TextStyle(color: textMuted),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: textPrimary),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: cyanAccent,
        unselectedItemColor: textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 10,
      ),
    );
  }
}
