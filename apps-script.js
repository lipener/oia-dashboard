// ═══════════════════════════════════════════════════════════════════════════
// OIÁ Dashboard — Apps Script Proxy
// ═══════════════════════════════════════════════════════════════════════════
//
// COMO PUBLICAR:
//   1. Abrir a planilha OIÁ no Google Sheets
//   2. Extensões → Apps Script
//   3. Colar este código substituindo todo o conteúdo
//   4. Implantar → Nova implantação → Tipo: Aplicativo da Web
//      - Executar como: Eu (rafael@railabs.com.br)
//      - Quem pode acessar: Qualquer pessoa
//   5. Copiar a URL gerada e colar em APPS_SCRIPT_URL no index.html
//   6. Para atualizar o código após mudanças: Implantar → Gerenciar implantações → Editar → Nova versão
//
// TABS LIDAS (todas opcionais — retorna [] se a aba não existir):
//   - meta_ads             → meta_daily
//   - ga4_sessions         → ga4_sessions
//   - ga4_sources          → ga4_sources
//   - ga4_pages            → ga4_pages
//   - ga4_geo              → ga4_geo
//   - gads_keywords        → gads_keywords  (= GADS_DAILY no JS)
//   - gads_campaigns       → gads_campaigns (= GADS_CAMPAIGN no JS — nível campanha, para IS)
//   - gads_auction_insights→ auction_insights
//
// TABS DISPONÍVEIS NO SHEETS (a integrar em V2):
//   gads_search_terms, gads_ads, gads_devices, gads_geo, gads_schedule, gads_yoy
//   meta_daily, meta_devices, meta_placements, meta_age_gender, meta_yoy
//   content_instagram
//
// CACHE: 5 min server-side via CacheService
// ═══════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1D38kterX7bSV_EK4Bs_2paV-8d3N5zvjV01OLF1EZfo';
const CACHE_KEY      = 'oia_dashboard_v1';
const CACHE_TTL      = 300; // segundos

// ─── Entry point ─────────────────────────────────────────────────────────────

function doGet(e) {
  // Cache server-side
  var cache  = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  if (cached) {
    return jsonResponse(cached);
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var data = {
    meta_daily:       getMetaDaily(ss),
    ga4_sessions:     getGa4Sessions(ss),
    ga4_sources:      getGa4Sources(ss),
    ga4_pages:        getGa4Pages(ss),
    ga4_geo:          getGa4Geo(ss),
    gads_keywords:    getGadsKeywords(ss),
    gads_campaigns:   getGadsCampaigns(ss),    // aba: gads_campaigns (nível campanha, para IS)
    auction_insights: getAuctionInsights(ss),  // aba: gads_auction_insights
    updated_at:       new Date().toISOString()
  };

  var json = JSON.stringify(data);

  // Só cacheia se couber no limite do CacheService (100 KB por chave)
  if (json.length < 100000) {
    cache.put(CACHE_KEY, json, CACHE_TTL);
  }

  return jsonResponse(json);
}

function jsonResponse(jsonStr) {
  return ContentService
    .createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converte sheet em array de objetos usando a primeira linha como headers.
 */
function sheetToJSON(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows[0];
  return rows.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Converte valor para float.
 * Trata separador decimal como vírgula (padrão europeu do Sheets).
 */
function toFloat(val) {
  if (val === '' || val === null || val === undefined) return null;
  var n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/**
 * Converte valor para inteiro.
 */
function toInt(val) {
  if (val === '' || val === null || val === undefined) return null;
  var n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

/**
 * Formata data como YYYY-MM-DD.
 * Aceita objetos Date (quando Sheets interpreta a célula como data) ou strings.
 */
function fmtDate(val) {
  if (!val) return null;
  if (val instanceof Date) return Utilities.formatDate(val, 'America/Sao_Paulo', 'yyyy-MM-dd');
  return String(val).slice(0, 10);
}

/**
 * Retorna null se valor for 0 ou falsy — útil para campos opcionais de retenção.
 */
function toIntOrNull(val) {
  var n = toInt(val);
  return (n === 0 || n === null) ? null : n;
}

// ─── meta_ads → meta_daily ───────────────────────────────────────────────────

function getMetaDaily(ss) {
  var sheet = ss.getSheetByName('meta_ads');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      date:        fmtDate(r.date_start),
      campaign:    r.campaign_name  || '',
      adset:       r.adset_name     || '',
      reach:       toInt(r.reach),
      impressions: toInt(r.impressions),
      spend:       toFloat(r.spend),
      cpm:         toFloat(r.cpm),
      frequency:   toFloat(r.frequency),
      clicksAll:   toInt(r.clicks),
      linkClicks:  toInt(r.link_clicks),
      lpViews:     toInt(r.landing_page_views),
      plays3s:     toInt(r.video_views),
      plays:       toIntOrNull(r.plays),
      thruPlays:   toIntOrNull(r.thru_plays),
      plays25:     toIntOrNull(r.video_p25),
      plays50:     toIntOrNull(r.video_p50),
      plays75:     toIntOrNull(r.video_p75),
      plays100:    toIntOrNull(r.video_p100)
    };
  });
}

// ─── ga4_sessions ────────────────────────────────────────────────────────────

function getGa4Sessions(ss) {
  var sheet = ss.getSheetByName('ga4_sessions');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      date:               fmtDate(r.date),
      sessions:           toInt(r.sessions),
      totalUsers:         toInt(r.totalUsers),
      newUsers:           toInt(r.newUsers),
      engagedSessions:    toInt(r.engagedSessions),
      avgSessionDuration: toFloat(r.avgSessionDuration),
      bounceRate:         toFloat(r.bounceRate)
    };
  });
}

// ─── ga4_sources ─────────────────────────────────────────────────────────────

function getGa4Sources(ss) {
  var sheet = ss.getSheetByName('ga4_sources');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      channelGroup: r.channelGroup || '',
      source:       r.source       || '',
      medium:       r.medium       || '',
      sessions:     toInt(r.sessions),
      totalUsers:   toInt(r.totalUsers),
      newUsers:     toInt(r.newUsers)
    };
  });
}

// ─── ga4_pages ───────────────────────────────────────────────────────────────

function getGa4Pages(ss) {
  var sheet = ss.getSheetByName('ga4_pages');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      page:               r.landingPage || '',
      sessions:           toInt(r.sessions),
      totalUsers:         toInt(r.totalUsers),
      newUsers:           toInt(r.newUsers),
      bounceRate:         toFloat(r.bounceRate),
      avgSessionDuration: toFloat(r.avgSessionDuration)
    };
  });
}

// ─── ga4_geo ─────────────────────────────────────────────────────────────────

function getGa4Geo(ss) {
  var sheet = ss.getSheetByName('ga4_geo');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      country:    r.country    || '',
      region:     r.region     || '',
      sessions:   toInt(r.sessions),
      totalUsers: toInt(r.totalUsers)
    };
  });
}

// ─── gads_keywords (= GADS_DAILY no HTML) ────────────────────────────────────
// Aba com dados keyword-level do Google Ads.
// Colunas reais no Sheets (confirmado 2026-04-11):
//   date, campaign, adgroup, keyword, clicks, impressions, cost,
//   clickShare, topIS, absTopIS, topEligible, absEligible,
//   topImpr, absImpr, csClicks, csMarket, actualTop, actualAbs

function getGadsKeywords(ss) {
  var sheet = ss.getSheetByName('gads_keywords');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      date:         fmtDate(r.date),
      campaign:     r.campaign    || '',
      adgroup:      r.adgroup     || '',
      keyword:      r.keyword     || '',
      clicks:       toInt(r.clicks),
      impressions:  toInt(r.impressions),
      cost:         toFloat(r.cost),
      clickShare:   toFloat(r.clickShare),
      topIS:        toFloat(r.topIS),
      absTopIS:     toFloat(r.absTopIS),
      topEligible:  toFloat(r.topEligible),
      absEligible:  toFloat(r.absEligible),
      topImpr:      toFloat(r.topImpr),
      absImpr:      toFloat(r.absImpr),
      csClicks:     toFloat(r.csClicks),
      csMarket:     toFloat(r.csMarket),
      actualTop:    toFloat(r.actualTop),
      actualAbs:    toFloat(r.actualAbs)
    };
  });
}

// ─── gads_campaigns (= GADS_CAMPAIGN no HTML) ────────────────────────────────
// Dados nível campanha do Google Ads — usado exclusivamente para cálculo de IS
// (search_impression_share é null no nível keyword para KWs de baixo volume).
// Colunas no Sheets:
//   date, campaign, clicks, impressions, cost,
//   is_raw, topIS_raw, absTop_raw, cs_raw,          (colunas A-I — raw fractions)
//   topEligible, absEligible, topImpr, absImpr,      (colunas J-M — derivados)
//   csClicks, csMarket, actualTop, actualAbs         (colunas N-Q — derivados)

function getGadsCampaigns(ss) {
  var sheet = ss.getSheetByName('gads_campaigns');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      date:         fmtDate(r.date),
      campaign:     r.campaign    || '',
      clicks:       toInt(r.clicks),
      impressions:  toInt(r.impressions),
      cost:         toFloat(r.cost),
      topEligible:  toFloat(r.topEligible),
      absEligible:  toFloat(r.absEligible),
      topImpr:      toFloat(r.topImpr),
      absImpr:      toFloat(r.absImpr),
      csClicks:     toFloat(r.csClicks),
      csMarket:     toFloat(r.csMarket),
      actualTop:    toFloat(r.actualTop),
      actualAbs:    toFloat(r.actualAbs)
    };
  });
}

// ─── gads_auction_insights ───────────────────────────────────────────────────
// Aba preenchida manualmente (download do Google Ads → colar no Sheets).
// Estrutura esperada:
//   period, competitor, impressionShare, overlapRate, posAboveRate,
//   topOfPageRate, absTopOfPageRate, outranking

// Colunas reais no Sheets (confirmado 2026-04-11):
//   date, campaign, domain, impression_share, outranking_share,
//   overlap_rate, position_above_rate, top_impression_pct
// NOTA: dados preenchidos manualmente (download do Google Ads UI).
// O HTML usa AUCTION_DATA em formato aninhado — conversão V2 (TODO).
// Por ora o Apps Script retorna array plano; HTML mantém seed hardcoded.

function getAuctionInsights(ss) {
  var sheet = ss.getSheetByName('gads_auction_insights');
  if (!sheet) return [];
  var rows = sheetToJSON(sheet);
  return rows.map(function(r) {
    return {
      date:            fmtDate(r.date),
      campaign:        r.campaign         || '',
      domain:          r.domain           || '',
      impressionShare: toFloat(r.impression_share),
      outrankingShare: toFloat(r.outranking_share),
      overlapRate:     toFloat(r.overlap_rate),
      posAboveRate:    toFloat(r.position_above_rate),
      topImpressionPct:toFloat(r.top_impression_pct)
    };
  });
}