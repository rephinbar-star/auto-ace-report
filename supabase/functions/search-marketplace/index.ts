import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface SearchParams {
  year?: number;
  minYear?: number;
  maxYear?: number;
  make?: string;
  model?: string;
  zipCode?: string;
  radiusMiles?: number;
  maxPrice?: number;
  minPrice?: number;
  maxMileage?: number;
  bodyStyle?: string;
  page?: number;
  limit?: number;
}

// Comprehensive ZIP prefix → state mapping (3-digit prefix ranges)
const ZIP_PREFIX_TO_STATE: Record<string, string> = {
  "005": "NY", "006": "PR", "007": "PR", "008": "VI", "009": "PR",
  "010": "MA", "011": "MA", "012": "MA", "013": "MA", "014": "MA", "015": "MA", "016": "MA", "017": "MA", "018": "MA", "019": "MA",
  "020": "MA", "021": "MA", "022": "MA", "023": "MA", "024": "MA", "025": "MA", "026": "MA", "027": "MA",
  "028": "RI", "029": "RI",
  "030": "NH", "031": "NH", "032": "NH", "033": "NH", "034": "NH", "035": "NH", "036": "NH", "037": "NH", "038": "NH",
  "039": "ME", "040": "ME", "041": "ME", "042": "ME", "043": "ME", "044": "ME", "045": "ME", "046": "ME", "047": "ME", "048": "ME", "049": "ME",
  "050": "VT", "051": "VT", "052": "VT", "053": "VT", "054": "VT", "056": "VT", "057": "VT", "058": "VT", "059": "VT",
  "060": "CT", "061": "CT", "062": "CT", "063": "CT", "064": "CT", "065": "CT", "066": "CT", "067": "CT", "068": "CT", "069": "CT",
  "070": "NJ", "071": "NJ", "072": "NJ", "073": "NJ", "074": "NJ", "075": "NJ", "076": "NJ", "077": "NJ", "078": "NJ", "079": "NJ",
  "080": "NJ", "081": "NJ", "082": "NJ", "083": "NJ", "084": "NJ", "085": "NJ", "086": "NJ", "087": "NJ", "088": "NJ", "089": "NJ",
  "100": "NY", "101": "NY", "102": "NY", "103": "NY", "104": "NY", "105": "NY", "106": "NY", "107": "NY", "108": "NY", "109": "NY",
  "110": "NY", "111": "NY", "112": "NY", "113": "NY", "114": "NY", "115": "NY", "116": "NY", "117": "NY", "118": "NY", "119": "NY",
  "120": "NY", "121": "NY", "122": "NY", "123": "NY", "124": "NY", "125": "NY", "126": "NY", "127": "NY", "128": "NY", "129": "NY",
  "130": "NY", "131": "NY", "132": "NY", "133": "NY", "134": "NY", "135": "NY", "136": "NY", "137": "NY", "138": "NY", "139": "NY",
  "140": "NY", "141": "NY", "142": "NY", "143": "NY", "144": "NY", "145": "NY", "146": "NY", "147": "NY", "148": "NY", "149": "NY",
  "150": "PA", "151": "PA", "152": "PA", "153": "PA", "154": "PA", "155": "PA", "156": "PA", "157": "PA", "158": "PA", "159": "PA",
  "160": "PA", "161": "PA", "162": "PA", "163": "PA", "164": "PA", "165": "PA", "166": "PA", "167": "PA", "168": "PA", "169": "PA",
  "170": "PA", "171": "PA", "172": "PA", "173": "PA", "174": "PA", "175": "PA", "176": "PA", "177": "PA", "178": "PA", "179": "PA",
  "180": "PA", "181": "PA", "182": "PA", "183": "PA", "184": "PA", "185": "PA", "186": "PA", "187": "PA", "188": "PA", "189": "PA",
  "190": "PA", "191": "PA", "192": "PA", "193": "PA", "194": "PA", "195": "PA", "196": "PA",
  "197": "DE", "198": "DE", "199": "DE",
  "200": "DC", "201": "VA", "202": "DC", "203": "DC", "204": "DC", "205": "DC",
  "206": "MD", "207": "MD", "208": "MD", "209": "MD", "210": "MD", "211": "MD", "212": "MD", "214": "MD", "215": "MD", "216": "MD", "217": "MD", "218": "MD", "219": "MD",
  "220": "VA", "221": "VA", "222": "VA", "223": "VA", "224": "VA", "225": "VA", "226": "VA", "227": "VA", "228": "VA", "229": "VA",
  "230": "VA", "231": "VA", "232": "VA", "233": "VA", "234": "VA", "235": "VA", "236": "VA", "237": "VA", "238": "VA", "239": "VA",
  "240": "VA", "241": "VA", "242": "VA", "243": "VA", "244": "VA", "245": "VA", "246": "VA",
  "247": "WV", "248": "WV", "249": "WV", "250": "WV", "251": "WV", "252": "WV", "253": "WV", "254": "WV", "255": "WV", "256": "WV", "257": "WV", "258": "WV", "259": "WV",
  "260": "WV", "261": "WV", "262": "WV", "263": "WV", "264": "WV", "265": "WV", "266": "WV", "267": "WV", "268": "WV",
  "270": "NC", "271": "NC", "272": "NC", "273": "NC", "274": "NC", "275": "NC", "276": "NC", "277": "NC", "278": "NC", "279": "NC",
  "280": "NC", "281": "NC", "282": "NC", "283": "NC", "284": "NC", "285": "NC", "286": "NC", "287": "NC", "288": "NC", "289": "NC",
  "290": "SC", "291": "SC", "292": "SC", "293": "SC", "294": "SC", "295": "SC", "296": "SC", "297": "SC", "298": "SC", "299": "SC",
  "300": "GA", "301": "GA", "302": "GA", "303": "GA", "304": "GA", "305": "GA", "306": "GA", "307": "GA", "308": "GA", "309": "GA",
  "310": "GA", "311": "GA", "312": "GA", "313": "GA", "314": "GA", "315": "GA", "316": "GA", "317": "GA", "318": "GA", "319": "GA",
  "320": "FL", "321": "FL", "322": "FL", "323": "FL", "324": "FL", "325": "FL", "326": "FL", "327": "FL", "328": "FL", "329": "FL",
  "330": "FL", "331": "FL", "332": "FL", "333": "FL", "334": "FL", "335": "FL", "336": "FL", "337": "FL", "338": "FL",
  "339": "FL", "340": "FL", "341": "FL", "342": "FL", "344": "FL", "346": "FL", "347": "FL", "349": "FL",
  "350": "AL", "351": "AL", "352": "AL", "354": "AL", "355": "AL", "356": "AL", "357": "AL", "358": "AL", "359": "AL",
  "360": "AL", "361": "AL", "362": "AL", "363": "AL", "364": "AL", "365": "AL", "366": "AL", "367": "AL", "368": "AL", "369": "AL",
  "370": "TN", "371": "TN", "372": "TN", "373": "TN", "374": "TN", "375": "TN", "376": "TN", "377": "TN", "378": "TN", "379": "TN",
  "380": "TN", "381": "TN", "382": "TN", "383": "TN", "384": "TN", "385": "TN",
  "386": "MS", "387": "MS", "388": "MS", "389": "MS", "390": "MS", "391": "MS", "392": "MS", "393": "MS", "394": "MS", "395": "MS", "396": "MS", "397": "MS",
  "398": "GA", "399": "GA",
  "400": "KY", "401": "KY", "402": "KY", "403": "KY", "404": "KY", "405": "KY", "406": "KY", "407": "KY", "408": "KY", "409": "KY",
  "410": "KY", "411": "KY", "412": "KY", "413": "KY", "414": "KY", "415": "KY", "416": "KY", "417": "KY", "418": "KY",
  "420": "KY", "421": "KY", "422": "KY", "423": "KY", "424": "KY", "425": "KY", "426": "KY", "427": "KY",
  "430": "OH", "431": "OH", "432": "OH", "433": "OH", "434": "OH", "435": "OH", "436": "OH", "437": "OH", "438": "OH", "439": "OH",
  "440": "OH", "441": "OH", "442": "OH", "443": "OH", "444": "OH", "445": "OH", "446": "OH", "447": "OH", "448": "OH", "449": "OH",
  "450": "OH", "451": "OH", "452": "OH", "453": "OH", "454": "OH", "455": "OH", "456": "OH", "457": "OH", "458": "OH",
  "460": "IN", "461": "IN", "462": "IN", "463": "IN", "464": "IN", "465": "IN", "466": "IN", "467": "IN", "468": "IN", "469": "IN",
  "470": "IN", "471": "IN", "472": "IN", "473": "IN", "474": "IN", "475": "IN", "476": "IN", "477": "IN", "478": "IN", "479": "IN",
  "480": "MI", "481": "MI", "482": "MI", "483": "MI", "484": "MI", "485": "MI", "486": "MI", "487": "MI", "488": "MI", "489": "MI",
  "490": "MI", "491": "MI", "492": "MI", "493": "MI", "494": "MI", "495": "MI", "496": "MI", "497": "MI", "498": "MI", "499": "MI",
  "500": "IA", "501": "IA", "502": "IA", "503": "IA", "504": "IA", "505": "IA", "506": "IA", "507": "IA", "508": "IA", "509": "IA",
  "510": "IA", "511": "IA", "512": "IA", "513": "IA", "514": "IA", "515": "IA", "516": "IA", "520": "IA", "521": "IA", "522": "IA", "523": "IA", "524": "IA", "525": "IA", "526": "IA", "527": "IA", "528": "IA",
  "530": "WI", "531": "WI", "532": "WI", "534": "WI", "535": "WI", "537": "WI", "538": "WI", "539": "WI",
  "540": "WI", "541": "WI", "542": "WI", "543": "WI", "544": "WI", "545": "WI", "546": "WI", "547": "WI", "548": "WI", "549": "WI",
  "550": "MN", "551": "MN", "553": "MN", "554": "MN", "555": "MN", "556": "MN", "557": "MN", "558": "MN", "559": "MN",
  "560": "MN", "561": "MN", "562": "MN", "563": "MN", "564": "MN", "565": "MN", "566": "MN", "567": "MN",
  "570": "SD", "571": "SD", "572": "SD", "573": "SD", "574": "SD", "575": "SD", "576": "SD", "577": "SD",
  "580": "ND", "581": "ND", "582": "ND", "583": "ND", "584": "ND", "585": "ND", "586": "ND", "587": "ND", "588": "ND",
  "590": "MT", "591": "MT", "592": "MT", "593": "MT", "594": "MT", "595": "MT", "596": "MT", "597": "MT", "598": "MT", "599": "MT",
  "600": "IL", "601": "IL", "602": "IL", "603": "IL", "604": "IL", "605": "IL", "606": "IL", "607": "IL", "608": "IL", "609": "IL",
  "610": "IL", "611": "IL", "612": "IL", "613": "IL", "614": "IL", "615": "IL", "616": "IL", "617": "IL", "618": "IL", "619": "IL",
  "620": "IL", "622": "IL", "623": "IL", "624": "IL", "625": "IL", "626": "IL", "627": "IL", "628": "IL", "629": "IL",
  "630": "MO", "631": "MO", "633": "MO", "634": "MO", "635": "MO", "636": "MO", "637": "MO", "638": "MO", "639": "MO",
  "640": "MO", "641": "MO", "644": "MO", "645": "MO", "646": "MO", "647": "MO", "648": "MO", "649": "MO",
  "650": "MO", "651": "MO", "652": "MO", "653": "MO", "654": "MO", "655": "MO", "656": "MO", "657": "MO", "658": "MO",
  "660": "KS", "661": "KS", "662": "KS", "664": "KS", "665": "KS", "666": "KS", "667": "KS", "668": "KS", "669": "KS",
  "670": "KS", "671": "KS", "672": "KS", "673": "KS", "674": "KS", "675": "KS", "676": "KS", "677": "KS", "678": "KS", "679": "KS",
  "680": "NE", "681": "NE", "683": "NE", "684": "NE", "685": "NE", "686": "NE", "687": "NE", "688": "NE", "689": "NE",
  "690": "NE", "691": "NE", "692": "NE", "693": "NE",
  "700": "LA", "701": "LA", "703": "LA", "704": "LA", "705": "LA", "706": "LA", "707": "LA", "708": "LA",
  "710": "LA", "711": "LA", "712": "LA", "713": "LA", "714": "LA",
  "716": "AR", "717": "AR", "718": "AR", "719": "AR", "720": "AR", "721": "AR", "722": "AR", "723": "AR", "724": "AR", "725": "AR", "726": "AR", "727": "AR", "728": "AR", "729": "AR",
  "730": "OK", "731": "OK", "733": "OK", "734": "OK", "735": "OK", "736": "OK", "737": "OK", "738": "OK", "739": "OK",
  "740": "OK", "741": "OK", "743": "OK", "744": "OK", "745": "OK", "746": "OK", "747": "OK", "748": "OK", "749": "OK",
  "750": "TX", "751": "TX", "752": "TX", "753": "TX", "754": "TX", "755": "TX", "756": "TX", "757": "TX", "758": "TX", "759": "TX",
  "760": "TX", "761": "TX", "762": "TX", "763": "TX", "764": "TX", "765": "TX", "766": "TX", "767": "TX", "768": "TX", "769": "TX",
  "770": "TX", "771": "TX", "772": "TX", "773": "TX", "774": "TX", "775": "TX", "776": "TX", "777": "TX", "778": "TX", "779": "TX",
  "780": "TX", "781": "TX", "782": "TX", "783": "TX", "784": "TX", "785": "TX", "786": "TX", "787": "TX", "788": "TX", "789": "TX",
  "790": "TX", "791": "TX", "792": "TX", "793": "TX", "794": "TX", "795": "TX", "796": "TX", "797": "TX", "798": "TX", "799": "TX",
  "800": "CO", "801": "CO", "802": "CO", "803": "CO", "804": "CO", "805": "CO", "806": "CO", "807": "CO", "808": "CO", "809": "CO",
  "810": "CO", "811": "CO", "812": "CO", "813": "CO", "814": "CO", "815": "CO", "816": "CO",
  "820": "WY", "821": "WY", "822": "WY", "823": "WY", "824": "WY", "825": "WY", "826": "WY", "827": "WY", "828": "WY", "829": "WY",
  "830": "WY", "831": "WY",
  "832": "ID", "833": "ID", "834": "ID", "835": "ID", "836": "ID", "837": "ID", "838": "ID",
  "840": "UT", "841": "UT", "842": "UT", "843": "UT", "844": "UT", "845": "UT", "846": "UT", "847": "UT",
  "850": "AZ", "851": "AZ", "852": "AZ", "853": "AZ", "855": "AZ", "856": "AZ", "857": "AZ", "858": "AZ", "859": "AZ",
  "860": "AZ", "863": "AZ", "864": "AZ", "865": "AZ",
  "870": "NM", "871": "NM", "872": "NM", "873": "NM", "874": "NM", "875": "NM", "877": "NM", "878": "NM", "879": "NM",
  "880": "NM", "881": "NM", "882": "NM", "883": "NM", "884": "NM",
  "885": "TX",
  "889": "NV", "890": "NV", "891": "NV", "893": "NV", "894": "NV", "895": "NV", "897": "NV", "898": "NV",
  "900": "CA", "901": "CA", "902": "CA", "903": "CA", "904": "CA", "905": "CA", "906": "CA", "907": "CA", "908": "CA", "909": "CA",
  "910": "CA", "911": "CA", "912": "CA", "913": "CA", "914": "CA", "915": "CA", "916": "CA", "917": "CA", "918": "CA", "919": "CA",
  "920": "CA", "921": "CA", "922": "CA", "923": "CA", "924": "CA", "925": "CA", "926": "CA", "927": "CA", "928": "CA",
  "930": "CA", "931": "CA", "932": "CA", "933": "CA", "934": "CA", "935": "CA", "936": "CA", "937": "CA", "938": "CA", "939": "CA",
  "940": "CA", "941": "CA", "942": "CA", "943": "CA", "944": "CA", "945": "CA", "946": "CA", "947": "CA", "948": "CA", "949": "CA",
  "950": "CA", "951": "CA", "952": "CA", "953": "CA", "954": "CA", "955": "CA", "956": "CA", "957": "CA", "958": "CA", "959": "CA",
  "960": "CA", "961": "CA",
  "967": "HI", "968": "HI",
  "970": "OR", "971": "OR", "972": "OR", "973": "OR", "974": "OR", "975": "OR", "976": "OR", "977": "OR", "978": "OR", "979": "OR",
  "980": "WA", "981": "WA", "982": "WA", "983": "WA", "984": "WA", "985": "WA", "986": "WA", "988": "WA", "989": "WA",
  "990": "WA", "991": "WA", "992": "WA", "993": "WA", "994": "WA",
  "995": "AK", "996": "AK", "997": "AK", "998": "AK", "999": "AK",
};

function getStateFromZip(zip: string): string | null {
  if (!zip || zip.length < 3) return null;
  const prefix = zip.substring(0, 3);
  return ZIP_PREFIX_TO_STATE[prefix] ?? null;
}

function getNeighborStates(state: string, radiusMiles: number): string[] {
  // For large radius, include more states
  if (radiusMiles >= 500) return []; // don't filter at all
  if (radiusMiles >= 250) {
    const direct = STATE_NEIGHBORS[state] ?? [state];
    // Also add neighbors of neighbors for 250+ mile radius
    const extended = new Set(direct);
    direct.forEach(s => {
      (STATE_NEIGHBORS[s] ?? [s]).forEach(n => extended.add(n));
    });
    return Array.from(extended);
  }
  return STATE_NEIGHBORS[state] ?? [state];
}

function buildCacheKey(p: SearchParams, radiusMiles: number): string {
  // Normalize to lowercase for consistent cache hits
  return [
    (p.make || "any").toLowerCase(),
    (p.model || "any").toLowerCase(),
    p.minYear || "any",
    p.maxYear || "any",
    p.zipCode || "any",
    radiusMiles,
    p.maxPrice || "any",
    p.minPrice || "any",
    p.maxMileage || "any",
    p.bodyStyle || "any",
  ].join(":");
}

function mapMarketCheckListing(item: Record<string, unknown>, fetchedForZip?: string) {
  const build = (item.build as Record<string, unknown>) || {};
  const price = item.price ?? item.dp_price ?? null;
  const dealer = (item.dealer as Record<string, unknown>) || {};
  return {
    external_id: String(item.id),
    source: "marketcheck",
    status: "active",
    year: Number(build.year ?? item.year ?? 0),
    make: String(build.make ?? item.make ?? ""),
    model: String(build.model ?? item.model ?? ""),
    trim: String(build.trim ?? item.trim ?? "") || null,
    mileage: item.miles ? Number(item.miles) : null,
    asking_price: price ? Number(price) : 0,
    vin: item.vin ? String(item.vin) : null,
    listing_url: item.vdp_url ? String(item.vdp_url) : null,
    images: item.media
      ? [(item.media as Record<string, unknown>)?.photo_links as string[] ?? []].flat()
      : [],
    seller_name: dealer.name ? String(dealer.name) : null,
    seller_type: "dealer",
    city: dealer.city ? String(dealer.city) : null,
    state: dealer.state ? String(dealer.state) : null,
    zip_code: dealer.zip ? String(dealer.zip) : null,
    body_style: build.body_type ? String(build.body_type) : null,
    fuel_type: build.fuel_type ? String(build.fuel_type) : null,
    transmission: build.transmission ? String(build.transmission) : null,
    drivetrain: build.drivetrain ? String(build.drivetrain) : null,
    exterior_color: item.exterior_color ? String(item.exterior_color) : null,
    condition: "good",
    fetched_at: new Date().toISOString(),
    fetched_for_zip: fetchedForZip ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const ip = getClientIp(req);
  const authHeader = req.headers.get("Authorization");
  const isAuthed = !!authHeader?.startsWith("Bearer ");
  const rateLimitConfig = isAuthed ? RATE_LIMITS.standard : RATE_LIMITS.public;
  const rateLimit = checkRateLimit(ip, { ...rateLimitConfig, keyPrefix: "search-marketplace" });

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retryAfter: rateLimit.retryAfter }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  try {
    const params: SearchParams = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : Object.fromEntries(new URL(req.url).searchParams);

    const page = Number(params.page ?? 1);
    const limit = Math.min(Number(params.limit ?? 20), 50);
    const radiusMiles = Number(params.radiusMiles ?? 100);
    const offset = (page - 1) * limit;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const marketCheckApiKey = Deno.env.get("MARKETCHECK_API_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const cacheKey = buildCacheKey(params, radiusMiles);

    // Check cache freshness
    const { data: cacheRow } = await adminClient
      .from("marketplace_search_cache")
      .select("last_fetched_at, total_results")
      .eq("search_key", cacheKey)
      .maybeSingle();

    const isCacheFresh =
      cacheRow &&
      Date.now() - new Date(cacheRow.last_fetched_at).getTime() < CACHE_TTL_MS;

    // Check if we actually have DB rows for this ZIP before trusting the cache
    let dbHasData = false;
    if (isCacheFresh && params.zipCode) {
      const { count: existingCount } = await adminClient
        .from("marketplace_listings")
        .select("id", { count: "exact", head: true })
        .eq("fetched_for_zip", params.zipCode)
        .eq("status", "active");
      dbHasData = (existingCount ?? 0) > 0;
      if (!dbHasData) {
        console.log(`Cache says fresh but DB has 0 rows for ZIP ${params.zipCode} — forcing re-fetch`);
      }
    }

    let fetchedFromMarketCheck = false;

    // --- STALE or empty DB: fetch from MarketCheck (multiple pages for diversity) ---
    // IMPORTANT: Only fetch if a zipCode is provided — never do a national fetch
    // without geo-filtering as it returns random results from all over the country.
    if ((!isCacheFresh || !dbHasData) && marketCheckApiKey && params.zipCode) {
      try {
        const ROWS_PER_BATCH = 50;
        // 6 batches × 50 rows = up to 300 candidates across diverse offsets
        const NUM_BATCHES = 6;
        const MAX_PER_DEALER = 20; // allow more per dealer so we get enough total volume
        let totalCount = 0;
        let allFetchedListings: Record<string, unknown>[] = [];

        const buildMcUrl = (start: number, rows: number) => {
          const u = new URL("https://api.marketcheck.com/v2/search/car/active");
          u.searchParams.set("api_key", marketCheckApiKey);
          u.searchParams.set("rows", String(rows));
          u.searchParams.set("start", String(start));
          u.searchParams.set("zip", params.zipCode);
          u.searchParams.set("radius", String(Math.min(radiusMiles, 100)));
          if (params.minYear) u.searchParams.set("year_min", String(params.minYear));
          if (params.maxYear) u.searchParams.set("year_max", String(params.maxYear));
          if (params.make) u.searchParams.set("make", params.make);
          if (params.model) u.searchParams.set("model", params.model);
          if (params.maxPrice) u.searchParams.set("price_max", String(params.maxPrice));
          if (params.minPrice) u.searchParams.set("price_min", String(params.minPrice));
          if (params.maxMileage) u.searchParams.set("miles_max", String(params.maxMileage));
          if (params.bodyStyle) u.searchParams.set("body_style", params.bodyStyle);
          return u.toString();
        };

        // --- Step 1: Probe call to get num_found ---
        const probeRes = await fetch(buildMcUrl(0, 1));
        if (probeRes.ok) {
          const probeData = await probeRes.json();
          totalCount = probeData.num_found ?? 0;
          console.log(`MarketCheck probe: num_found=${totalCount} for ZIP ${params.zipCode}`);
        }

        // --- Step 2: spread offsets across the full available range ---
        // Use evenly-spaced + jittered offsets to maximize make/dealer diversity
        const safeMax = Math.max(0, Math.min(totalCount - ROWS_PER_BATCH, 450));
        const offsets: number[] = [];
        const attempts = new Set<number>();
        if (safeMax === 0) {
          offsets.push(0);
        } else {
          // Evenly-spaced buckets with random jitter for maximum spread
          for (let i = 0; i < NUM_BATCHES; i++) {
            const bucketStart = Math.floor((safeMax / NUM_BATCHES) * i);
            const bucketEnd = Math.floor((safeMax / NUM_BATCHES) * (i + 1));
            let candidate = bucketStart + Math.floor(Math.random() * (bucketEnd - bucketStart + 1));
            candidate = Math.min(candidate, safeMax);
            // dedupe
            while (attempts.has(candidate) && candidate < safeMax) candidate++;
            attempts.add(candidate);
            offsets.push(candidate);
          }
        }

        console.log(`Fetching ${offsets.length} batches at offsets: ${offsets.join(', ')}`);

        // --- Step 3: Fetch batches sequentially with a small delay to avoid rate limits ---
        for (let i = 0; i < offsets.length; i++) {
          const start = offsets[i];
          if (i > 0) await new Promise(r => setTimeout(r, 300)); // 300ms gap
          const mcRes = await fetch(buildMcUrl(start, ROWS_PER_BATCH));
          if (!mcRes.ok) {
            const errText = await mcRes.text();
            console.error(`MarketCheck batch start=${start} error:`, mcRes.status, errText.slice(0, 200));
            continue;
          }
          const mcData = await mcRes.json();
          const pageListing = (mcData.listings ?? []) as Record<string, unknown>[];
          totalCount = mcData.num_found ?? totalCount;
          console.log(`Batch start=${start}: ${pageListing.length} listings`);
          allFetchedListings = allFetchedListings.concat(pageListing);
        }

        // --- Step 4: Deduplicate by external_id ---
        const seenIds = new Set<string>();
        allFetchedListings = allFetchedListings.filter(item => {
          const id = String(item.id);
          if (seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });

        // --- Step 5: Apply per-dealer cap (20 per seller_name) ---
        const dealerCounts = new Map<string, number>();
        allFetchedListings = allFetchedListings.filter(item => {
          const dealer = (item.dealer as Record<string, unknown>) || {};
          const name = String(dealer.name ?? "unknown");
          const count = dealerCounts.get(name) ?? 0;
          if (count >= MAX_PER_DEALER) return false;
          dealerCounts.set(name, count + 1);
          return true;
        });

        console.log(`After dedup + dealer cap: ${allFetchedListings.length} listings from ${dealerCounts.size} dealers`);

        if (allFetchedListings.length > 0) {
          const rows = allFetchedListings.map(item => mapMarketCheckListing(item, params.zipCode));

          // --- Step 6: Soft-expire old listings for this ZIP, then insert new batch ---
          // Mark all existing marketcheck listings for this ZIP as expired first
          await adminClient
            .from("marketplace_listings")
            .update({ status: "expired" })
            .eq("source", "marketcheck")
            .eq("fetched_for_zip", params.zipCode);

          // Re-activate any that reappear in the new fetch (upsert by external_id)
          const externalIds = rows.map(r => r.external_id);
          const { data: existing } = await adminClient
            .from("marketplace_listings")
            .select("external_id")
            .in("external_id", externalIds);

          const existingIdSet = new Set((existing ?? []).map((r: { external_id: string }) => r.external_id));

          // Reactivate existing rows that reappeared
          if (existingIdSet.size > 0) {
            await adminClient
              .from("marketplace_listings")
              .update({ status: "active", fetched_at: new Date().toISOString() })
              .in("external_id", Array.from(existingIdSet));
          }

          // Insert truly new rows
          const newRows = rows.filter(r => !existingIdSet.has(r.external_id));
          if (newRows.length > 0) {
            const { error: insertError } = await adminClient
              .from("marketplace_listings")
              .insert(newRows);
            if (insertError) {
              console.error("Insert error:", JSON.stringify(insertError));
            } else {
              console.log(`Inserted ${newRows.length} new + reactivated ${existingIdSet.size} existing listings`);
            }
          } else {
            console.log(`All ${rows.length} listings reactivated from existing DB rows`);
          }

          // Write cache
          await adminClient
            .from("marketplace_search_cache")
            .upsert(
              {
                search_key: cacheKey,
                last_fetched_at: new Date().toISOString(),
                total_results: totalCount,
              },
              { onConflict: "search_key" }
            );

          fetchedFromMarketCheck = true;
        } else {
          console.log("MarketCheck returned 0 listings — not writing cache to allow retry");
        }
      } catch (mcErr) {
        console.error("MarketCheck fetch failed:", mcErr);
      }
    }

    // --- Query marketplace_listings with filters ---
    // Filter by fetched_for_zip so only listings fetched for the user's ZIP are returned.
    // This ensures geo-accuracy: listings from different search regions never bleed into
    // each other, regardless of how MarketCheck distributes dealer locations.
    let userState: string | null = null;
    if (params.zipCode && params.zipCode.length === 5) {
      userState = getStateFromZip(params.zipCode);
      console.log(`ZIP ${params.zipCode} → state ${userState}, filtering DB to fetched_for_zip=${params.zipCode}`);
    }

    // Fetch ALL active listings for this ZIP then interleave by dealer so every page
    // shows a diverse mix of makes. PostgREST doesn't support ORDER BY RANDOM().
    const POOL_SIZE = 1000;
    let query = adminClient
      .from("marketplace_listings")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("id", { ascending: true }) // stable order for consistent pool
      .range(0, POOL_SIZE - 1);

    if (params.minYear) query = query.gte("year", params.minYear);
    if (params.maxYear) query = query.lte("year", params.maxYear);
    if (params.make) query = query.ilike("make", `%${params.make}%`);
    if (params.model) query = query.ilike("model", `%${params.model}%`);
    if (params.maxPrice) query = query.lte("asking_price", params.maxPrice);
    if (params.minPrice) query = query.gte("asking_price", params.minPrice);
    if (params.maxMileage) query = query.lte("mileage", params.maxMileage);
    if (params.bodyStyle) query = query.ilike("body_style", `%${params.bodyStyle}%`);

    // Strictly filter by fetched_for_zip when ZIP provided.
    // Never fall back to a broad OR that includes unrelated listings.
    if (params.zipCode) {
      // MarketCheck listings for this exact ZIP, or user-submitted in the same state.
      if (userState) {
        query = query.or(
          `fetched_for_zip.eq.${params.zipCode},and(source.eq.user_submitted,state.eq.${userState})`
        );
      } else {
        query = query.eq("fetched_for_zip", params.zipCode);
      }
    } else {
      // No ZIP provided: only show user-submitted listings (no random national MarketCheck results)
      query = query.eq("source", "user_submitted");
    }

    const { data: rawListings, count, error } = await query;

    if (error) {
      console.error("DB query error:", JSON.stringify(error));
      throw new Error(`DB query failed: ${error.message ?? error.code ?? JSON.stringify(error)}`);
    }

    // Seeded shuffle — same search params always produce the same order across pages,
    // preventing duplicates and ensuring coherent pagination.
    function seededRng(seed: number) {
      let s = seed >>> 0;
      return () => {
        s = Math.imul(s ^ (s >>> 15), s | 1);
        s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
        return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff;
      };
    }
    // Derive seed from cacheKey so same filters → same shuffle
    let seedVal = 0;
    for (let i = 0; i < cacheKey.length; i++) {
      seedVal = (Math.imul(31, seedVal) + cacheKey.charCodeAt(i)) >>> 0;
    }
    const rng = seededRng(seedVal);

    const pool = rawListings ?? [];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const listings = pool.slice(offset, offset + limit);

    console.log(`DB pool: ${pool.length} listings (seed ${seedVal}), serving page ${page} (${listings.length} listings)`);

    // Use actual DB row count for pagination so the UI knows how many pages exist.
    const totalResults = count ?? pool.length;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          listings,
          total: totalResults,
          dbCount: count ?? pool.length, // actual rows in DB matching filters
          page,
          limit,
          cached: !!(isCacheFresh && !fetchedFromMarketCheck),
          source: fetchedFromMarketCheck ? "marketcheck" : "cache",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("search-marketplace error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
