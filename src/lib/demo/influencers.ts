import type { Influencer, Platform, Weighted } from "../types";
import { rng } from "../utils";

/**
 * DEMONSTRATION DATA — every profile below is fictional and generated in code.
 * Names, handles and all analytics are illustrative only and are never verified analytics.
 */
type Arch = "emirati" | "arab" | "expat" | "southasian" | "gcc" | "filipino" | "global";
type Row = [name: string, handle: string, platform: Platform, followers: number, er: number, arch: Arch, city: string, langs: string, cats: string, style: string, age: "young" | "mid" | "mature"];

const ROWS: Row[] = [
  ["Rashid Al Mheiri", "rashid.explains", "instagram", 412000, 3.9, "emirati", "Dubai", "Arabic", "Technology,Government & civic", "Calm explainers to camera", "mid"],
  ["Maitha Al Zaabi", "maitha.daily", "instagram", 168000, 5.2, "emirati", "Abu Dhabi", "Arabic", "Family,Lifestyle,Parenting", "Warm family vlogs", "mid"],
  ["Saif Bin Hareb", "saifonthego", "tiktok", 890000, 7.4, "emirati", "Dubai", "Arabic", "Youth,Comedy,Technology", "Fast comedic sketches", "young"],
  ["Hessa Al Kaabi", "hessa.learns", "tiktok", 74000, 9.1, "emirati", "Al Ain", "Arabic", "Education,Youth", "Study tips and how-tos", "young"],
  ["Khalfan Al Suwaidi", "khalfan.majlis", "snapchat", 520000, 4.4, "emirati", "Sharjah", "Arabic", "Culture & heritage,Government & civic", "Daily snaps, community voice", "mature"],
  ["Noura Al Hashmi", "noura.biz", "linkedin", 48000, 3.1, "emirati", "Dubai", "Arabic,English", "Business,Entrepreneurship", "Professional insight posts", "mature"],
  ["Omar El Sayed", "omar.techbyte", "youtube", 1350000, 2.6, "arab", "Dubai", "Arabic", "Technology,Education", "Long-form reviews and tutorials", "mid"],
  ["Lina Haddad", "lina.in.dubai", "instagram", 295000, 4.1, "arab", "Dubai", "Arabic,English", "Lifestyle,Food,Travel", "Polished lifestyle reels", "mid"],
  ["Tarek Mansour", "tarek.money", "instagram", 132000, 3.6, "arab", "Abu Dhabi", "Arabic", "Finance,Business", "Whiteboard-style explainers", "mid"],
  ["Dana Khoury", "dana.mama", "instagram", 86000, 6.3, "arab", "Sharjah", "Arabic", "Parenting,Family", "Relatable parenting stories", "mid"],
  ["Youssef Nabil", "youssef.plays", "tiktok", 640000, 8.2, "arab", "Dubai", "Arabic", "Gaming,Youth,Comedy", "Trend-led short video", "young"],
  ["Hala Barakat", "hala.reports", "x", 210000, 1.9, "arab", "Dubai", "Arabic", "News & media,Government & civic", "News threads and commentary", "mature"],
  ["James Whitfield", "jameswhitfield", "instagram", 224000, 3.3, "expat", "Dubai", "English", "Lifestyle,Travel,Fitness", "Cinematic day-in-the-life", "mid"],
  ["Sophie Laurent", "sophie.settles", "instagram", 67000, 5.8, "expat", "Dubai", "English,French", "Lifestyle,Family", "New-resident guides", "mid"],
  ["Daniel Okafor", "dan.builds", "youtube", 310000, 3.0, "expat", "Dubai", "English", "Technology,Entrepreneurship", "Product walkthroughs", "mid"],
  ["Emma Carter", "emmacarter.dxb", "tiktok", 455000, 6.7, "expat", "Dubai", "English", "Lifestyle,Food,Comedy", "Witty voice-over shorts", "young"],
  ["Oliver Bennett", "oliver.onbusiness", "linkedin", 92000, 2.4, "expat", "Abu Dhabi", "English", "Business,Finance", "Thought-leadership posts", "mature"],
  ["Hannah Reid", "hannah.homelife", "facebook", 138000, 2.2, "expat", "Dubai", "English", "Family,Parenting", "Community group tips", "mature"],
  ["Arjun Menon", "arjun.dxb", "instagram", 380000, 4.6, "southasian", "Dubai", "Hindi,English", "Technology,Lifestyle", "Hinglish explainers", "mid"],
  ["Priya Nair", "priya.uaelife", "instagram", 145000, 6.1, "southasian", "Sharjah", "Hindi,Malayalam,English", "Family,Food,Lifestyle", "Home and community vlogs", "mid"],
  ["Imran Qureshi", "imran.uaeguide", "youtube", 720000, 3.4, "southasian", "Dubai", "Urdu,Hindi", "Education,Government & civic", "Step-by-step resident guides", "mid"],
  ["Sneha Kapoor", "sneha.saves", "tiktok", 265000, 7.8, "southasian", "Dubai", "Hindi,English", "Finance,Lifestyle", "Budget hacks in 30 seconds", "young"],
  ["Faisal Rahman", "faisal.fixit", "facebook", 96000, 3.7, "southasian", "Ajman", "Urdu,Bengali", "Education,Automotive", "Practical how-to videos", "mature"],
  ["Rohit Verma", "rohit.reels", "instagram", 58000, 8.4, "southasian", "Abu Dhabi", "Hindi", "Comedy,Youth", "Comedy skits", "young"],
  ["Abdullah Al Otaibi", "abdullah.gulf", "snapchat", 2100000, 3.2, "gcc", "Riyadh", "Arabic", "Lifestyle,Travel,Automotive", "High-energy snaps", "mid"],
  ["Reem Al Sabah", "reem.style", "instagram", 1650000, 2.8, "gcc", "Kuwait City", "Arabic", "Fashion,Beauty", "Editorial fashion content", "mid"],
  ["Sultan Al Dosari", "sultan.live", "tiktok", 3400000, 5.1, "gcc", "Dubai", "Arabic", "Comedy,Youth,Gaming", "Live streams and challenges", "young"],
  ["Maria Santos", "maria.kabayan", "tiktok", 188000, 9.4, "filipino", "Dubai", "Tagalog,English", "Lifestyle,Food,Family", "Community humour and tips", "mid"],
  ["Paolo Reyes", "paolo.dxb", "facebook", 121000, 4.3, "filipino", "Dubai", "Tagalog,English", "Education,Lifestyle", "OFW how-to guides", "mid"],
  ["Zayed Al Nuaimi", "zayed.codes", "x", 64000, 2.7, "emirati", "Abu Dhabi", "Arabic,English", "Technology,Entrepreneurship", "Tech threads", "mid"],
  ["Layla Farouk", "layla.learnsai", "instagram", 39000, 7.2, "arab", "Dubai", "Arabic,English", "Technology,Education", "Carousel explainers", "young"],
  ["Ahmed Al Marzooqi", "ahmed.drives", "youtube", 480000, 3.8, "emirati", "Dubai", "Arabic", "Automotive,Technology", "Road-test style reviews", "mid"],
  ["Fatima Al Ali", "fatima.wellness", "instagram", 8200, 11.2, "emirati", "Ras Al Khaimah", "Arabic", "Fitness,Family", "Personal community stories", "mid"],
  ["Kareem Aziz", "kareem.startups", "instagram", 9400, 9.8, "arab", "Dubai", "Arabic,English", "Entrepreneurship,Business", "Founder diaries", "young"],
  ["Nikhil Shah", "nikhil.newhere", "instagram", 7600, 12.5, "southasian", "Dubai", "Hindi,English", "Lifestyle,Education", "New-to-UAE diaries", "young"],
  ["Chloe Adams", "chloe.abudhabi", "instagram", 21000, 6.9, "expat", "Abu Dhabi", "English", "Travel,Food", "Weekend guides", "mid"],
  ["Mansour Al Falasi", "mansour.official", "instagram", 6800000, 2.1, "emirati", "Dubai", "Arabic", "Culture & heritage,Lifestyle", "Aspirational storytelling", "mature"],
  ["Yasmin Idris", "yasmin.talks", "youtube", 245000, 4.0, "arab", "Dubai", "Arabic", "Education,Culture & heritage", "Podcast-style conversations", "mature"],
  ["Sara Thomas", "sara.techmum", "linkedin", 27000, 3.9, "southasian", "Dubai", "English,Malayalam", "Technology,Parenting", "Career and tech posts", "mid"],
  ["Hamdan Al Ketbi", "hamdan.outdoors", "snapchat", 310000, 5.6, "emirati", "Al Ain", "Arabic", "Travel,Culture & heritage", "Outdoor adventure snaps", "young"],
];

const GEO: Record<Arch, [string, string, number][]> = {
  emirati: [["United Arab Emirates", "AE", 0.72], ["Saudi Arabia", "SA", 0.08], ["Oman", "OM", 0.05], ["Kuwait", "KW", 0.04]],
  arab: [["United Arab Emirates", "AE", 0.46], ["Egypt", "EG", 0.14], ["Saudi Arabia", "SA", 0.12], ["Jordan", "JO", 0.07], ["Lebanon", "LB", 0.04]],
  expat: [["United Arab Emirates", "AE", 0.52], ["United Kingdom", "GB", 0.12], ["United States", "US", 0.07], ["India", "IN", 0.06]],
  southasian: [["United Arab Emirates", "AE", 0.47], ["India", "IN", 0.27], ["Pakistan", "PK", 0.09], ["Saudi Arabia", "SA", 0.04]],
  gcc: [["Saudi Arabia", "SA", 0.38], ["United Arab Emirates", "AE", 0.22], ["Kuwait", "KW", 0.14], ["Qatar", "QA", 0.06]],
  filipino: [["United Arab Emirates", "AE", 0.55], ["Philippines", "PH", 0.24], ["Saudi Arabia", "SA", 0.06]],
  global: [["United States", "US", 0.3], ["United Kingdom", "GB", 0.15], ["India", "IN", 0.12], ["United Arab Emirates", "AE", 0.08]],
};
const LANG: Record<Arch, [string, string, number][]> = {
  emirati: [["Arabic", "ar", 0.86], ["English", "en", 0.12]],
  arab: [["Arabic", "ar", 0.78], ["English", "en", 0.19]],
  expat: [["English", "en", 0.84], ["Arabic", "ar", 0.06], ["French", "fr", 0.03]],
  southasian: [["Hindi", "hi", 0.44], ["English", "en", 0.3], ["Urdu", "ur", 0.14], ["Malayalam", "ml", 0.08]],
  gcc: [["Arabic", "ar", 0.9], ["English", "en", 0.08]],
  filipino: [["Tagalog", "tl", 0.58], ["English", "en", 0.38]],
  global: [["English", "en", 0.8]],
};
const AGE: Record<Row[10], number[]> = {
  young: [0.12, 0.44, 0.3, 0.09, 0.04, 0.01],
  mid: [0.04, 0.24, 0.42, 0.2, 0.09, 0.01],
  mature: [0.01, 0.1, 0.33, 0.33, 0.2, 0.03],
};
const AGE_NAMES = ["13-17", "18-24", "25-34", "35-44", "45-64", "65+"];
const CITY_SHARE: Record<string, string[]> = {
  Dubai: ["Dubai", "Abu Dhabi", "Sharjah"], "Abu Dhabi": ["Abu Dhabi", "Dubai", "Al Ain"], Sharjah: ["Sharjah", "Dubai", "Ajman"],
  "Al Ain": ["Al Ain", "Abu Dhabi", "Dubai"], Ajman: ["Ajman", "Sharjah", "Dubai"], "Ras Al Khaimah": ["Ras Al Khaimah", "Dubai", "Sharjah"],
  Riyadh: ["Riyadh", "Jeddah", "Dubai"], "Kuwait City": ["Kuwait City", "Riyadh", "Dubai"],
};
const COUNTRY_OF: Record<string, string> = { Riyadh: "Saudi Arabia", "Kuwait City": "Kuwait" };

function jitter(list: [string, string, number][], r: () => number): Weighted[] {
  const out = list.map(([name, code, w]) => ({ name, code, weight: Math.max(0.01, w * (0.88 + r() * 0.24)) }));
  const total = out.reduce((s, x) => s + x.weight, 0);
  const scale = total > 0.97 ? 0.97 / total : 1;
  return out.map((x) => ({ ...x, weight: +(x.weight * scale).toFixed(3) }));
}

export const DEMO_FETCHED_AT = "2026-11-01T08:00:00.000Z";

export function buildDemoInfluencers(): Influencer[] {
  return ROWS.map(([name, handle, platform, followers, er, arch, city, langs, cats, style, age]) => {
    const r = rng(handle);
    const video = platform === "tiktok" || platform === "youtube" || platform === "instagram" || platform === "snapchat";
    const viewRate = platform === "tiktok" ? 0.32 : platform === "youtube" ? 0.14 : platform === "snapchat" ? 0.12 : 0.2;
    const sizeDecay = followers > 2e6 ? 0.55 : followers > 5e5 ? 0.75 : followers > 1e5 ? 0.9 : 1.1;
    const avgViews = video ? Math.round(followers * viewRate * sizeDecay * (0.8 + r() * 0.4)) : undefined;
    const likes = Math.round(followers * (er / 100) * 0.93);
    const female = cats.match(/Parenting|Family|Beauty|Fashion/) ? 0.62 + r() * 0.14 : cats.match(/Gaming|Automotive|Technology|Finance/) ? 0.26 + r() * 0.12 : 0.44 + r() * 0.12;
    const ages = AGE[age].map((w, i) => ({ name: AGE_NAMES[i], weight: +(w * (0.9 + r() * 0.2)).toFixed(3) }));
    const cities = (CITY_SHARE[city] ?? [city]).map((c, i) => ({ name: c, weight: +([0.31, 0.14, 0.08][i] * (0.85 + r() * 0.3)).toFixed(3) }));
    const catList = cats.split(",");
    const growthBase = followers / (1 + 0.06 + r() * 0.2);
    const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
    return {
      id: `demo_${handle.replace(/[^a-z0-9]/g, "_")}`,
      name, handle, platform, followers,
      profileUrl: undefined,
      engagementRate: er / 100,
      avgViews, avgLikes: likes, avgComments: Math.round(likes * (0.02 + r() * 0.04)),
      country: COUNTRY_OF[city] ?? "United Arab Emirates", city,
      languages: langs.split(","), categories: catList, contentStyle: style,
      bio: `${style}. ${catList.join(" · ")}. (Fictional demonstration profile.)`,
      audience: {
        countries: jitter(GEO[arch], r), cities, ages,
        genders: [{ name: "Female", code: "FEMALE", weight: +female.toFixed(3) }, { name: "Male", code: "MALE", weight: +(1 - female).toFixed(3) }],
        languages: jitter(LANG[arch], r),
        interests: [...catList, ...(["Shopping", "Travel", "Technology", "Food"].filter((x) => !catList.includes(x)).slice(0, 2))].map((n, i) => ({ name: n, weight: +(0.42 - i * 0.07 + r() * 0.05).toFixed(3) })),
        credibility: +(0.74 + r() * 0.2 - (followers > 2e6 ? 0.08 : 0)).toFixed(3),
      },
      growth: months.map((m, i) => ({ month: m, followers: Math.round(growthBase + ((followers - growthBase) * (i + 1)) / months.length) })),
      sponsoredPerformance: +(0.7 + r() * 0.45).toFixed(2),
      recentPosts: [0, 1, 2].map((i) => ({
        caption: [`${catList[0]} tip of the week — ${style.toLowerCase()}`, `Behind the scenes in ${city}`, `Answering your questions about ${catList[catList.length - 1].toLowerCase()}`][i],
        likes: Math.round(likes * (0.7 + r() * 0.7)), views: avgViews ? Math.round(avgViews * (0.6 + r() * 0.9)) : undefined,
        date: `2026-10-${String(8 + i * 7).padStart(2, "0")}`, type: video ? "video" : "post",
      })),
      brandSafety: Math.round(72 + r() * 26 - (cats.includes("Comedy") ? 8 : 0)),
      source: "demo", fetchedAt: DEMO_FETCHED_AT,
      contact: { agency: r() > 0.5 ? "Demo Talent Agency" : undefined },
      feeHistory: [], approvalStatus: r() > 0.75 ? "approved" : "pending",
      addedAt: DEMO_FETCHED_AT,
    } satisfies Influencer;
  });
}
