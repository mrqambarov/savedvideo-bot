<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="uz">
      <head>
        <title>XML Sayt Xaritasi (Sitemap) — XIT FILM</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;display=swap" rel="stylesheet" />
        <style type="text/css">
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #08080c;
            color: #f1f5f9;
            font-family: 'Plus Jakarta Sans', sans-serif;
            padding: 30px 20px 60px 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          .header-box {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
          }
          .logo {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -1px;
            color: #fff;
          }
          .logo span { color: #8b5cf6; }
          .header-title h1 {
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 6px;
          }
          .header-title p {
            font-size: 13.5px;
            color: #94a3b8;
          }
          .stats-badge {
            background: rgba(139, 92, 246, 0.2);
            border: 1px solid #8b5cf6;
            padding: 10px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            color: #c4b5fd;
          }
          .table-box {
            background: rgba(18, 18, 23, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13.5px;
            text-align: left;
          }
          thead {
            background: rgba(255, 255, 255, 0.04);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          th {
            padding: 14px 18px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 1px;
          }
          td {
            padding: 14px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          }
          tr:hover td {
            background: rgba(139, 92, 246, 0.06);
          }
          a {
            color: #38bdf8;
            text-decoration: none;
            font-weight: 600;
            transition: 0.2s;
            display: inline-block;
            max-width: 500px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
          }
          a:hover {
            color: #a78bfa;
            text-decoration: underline;
          }
          .priority-pill {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
          }
          .freq-pill {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            background: rgba(255, 255, 255, 0.05);
            color: #cbd5e1;
          }
          .footer-note {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-box">
            <div class="header-title">
              <div class="logo">XIT<span>FILM</span></div>
              <h1>Google &amp; Yandex XML Sayt Xaritasi</h1>
              <p>Ushbu sahifa qidiruv tizimlari (Google, Yandex, Bing) uchun sayt sahifalari va kinolarini indekslashga yordam beradi.</p>
            </div>
            <div class="stats-badge">
              Jami URL manzillar: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> ta
            </div>
          </div>

          <div class="table-box">
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">#</th>
                  <th>Sahifa URL Manzili</th>
                  <th style="width: 140px;">Oxirgi Yangilanish</th>
                  <th style="width: 110px;">Davriylik</th>
                  <th style="width: 90px;">Ustuvorlik</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:urlset/sitemap:url">
                  <tr>
                    <td style="color: #64748b; font-weight: 700;"><xsl:value-of select="position()"/></td>
                    <td>
                      <a href="{sitemap:loc}" target="_blank">
                        <xsl:value-of select="sitemap:loc"/>
                      </a>
                    </td>
                    <td style="color: #94a3b8;"><xsl:value-of select="sitemap:lastmod"/></td>
                    <td><span class="freq-pill"><xsl:value-of select="sitemap:changefreq"/></span></td>
                    <td><span class="priority-pill"><xsl:value-of select="sitemap:priority"/></span></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>

          <div class="footer-note">
            XIT FILM © 2026 • Standart: sitemaps.org 0.9 Protocol
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
