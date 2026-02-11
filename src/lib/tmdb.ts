const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set");
  return key;
}

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
  media_type?: string;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TmdbMediaDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genres: { id: number; name: string }[];
  origin_country?: string[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TmdbSeason[];
  credits?: {
    cast: TmdbCastMember[];
  };
}

export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface TmdbSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  episodes: TmdbEpisode[];
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("language", "zh-CN");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function searchMedia(
  query: string,
  type: "movie" | "tv" | "multi" = "multi",
  page = 1
): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>(`/search/${type}`, {
    query,
    page: String(page),
  });
}

export async function getMediaDetails(
  type: "movie" | "tv",
  id: number
): Promise<TmdbMediaDetails> {
  return tmdbFetch<TmdbMediaDetails>(`/${type}/${id}`, {
    append_to_response: "credits",
  });
}

export async function getSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<TmdbSeasonDetails> {
  return tmdbFetch<TmdbSeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
}

export interface TmdbPersonCredit {
  id: number;
  title?: string;
  name?: string;
  media_type: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  episode_count?: number;
}

export interface TmdbPersonCreditsResponse {
  cast: TmdbPersonCredit[];
  crew: TmdbPersonCredit[];
}

export async function getPersonCredits(
  personId: number
): Promise<TmdbPersonCreditsResponse> {
  return tmdbFetch<TmdbPersonCreditsResponse>(
    `/person/${personId}/combined_credits`
  );
}

export function getImageUrl(path: string | null, size: string = "w500"): string {
  if (!path) return "/placeholder.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// Country code → Chinese name mapping
const COUNTRY_NAMES: Record<string, string> = {
  CN: "中国",
  HK: "中国香港",
  TW: "中国台湾",
  US: "美国",
  GB: "英国",
  JP: "日本",
  KR: "韩国",
  FR: "法国",
  DE: "德国",
  IN: "印度",
  IT: "意大利",
  ES: "西班牙",
  CA: "加拿大",
  AU: "澳大利亚",
  RU: "俄罗斯",
  BR: "巴西",
  MX: "墨西哥",
  TH: "泰国",
  SE: "瑞典",
  DK: "丹麦",
  NO: "挪威",
  NL: "荷兰",
  BE: "比利时",
  NZ: "新西兰",
  IE: "爱尔兰",
  SG: "新加坡",
  MY: "马来西亚",
  PH: "菲律宾",
  TR: "土耳其",
  PL: "波兰",
  AR: "阿根廷",
  ZA: "南非",
  EG: "埃及",
  IL: "以色列",
  AT: "奥地利",
  CH: "瑞士",
  PT: "葡萄牙",
  CZ: "捷克",
  FI: "芬兰",
  CO: "哥伦比亚",
};

export function getCountryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_NAMES[code] || code;
}
