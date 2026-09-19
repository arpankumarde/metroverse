import { BLUE_CORRIDOR, corridorEnd, corridorStart } from './corridor'

/**
 * The Delhi the line runs through (PLAN.md §19).
 *
 * Not a model of Delhi — a corridor environment, which the plan is explicit
 * about being the thing to build instead. What the player sees out of the
 * window is the couple of hundred metres either side of the viaduct, and that
 * is all that is here: the arterial road the metro was built down the middle
 * of, its footpaths and its trees, and the frontage of whatever the road runs
 * between.
 *
 * Two kinds of thing live here. Districts say what the ordinary background
 * buildings of a stretch are like, and are filled in procedurally so that six
 * kilometres of frontage does not have to be written out by hand. Landmarks
 * are the named buildings that actually stand there — the banks along
 * Barakhamba Road, the theatres at Mandi House — and are placed one by one,
 * because the point of them is that they are recognisably themselves.
 *
 * Adding a building is an edit to this file and nowhere else (PLAN.md §33).
 */

/** What a named building is, which decides how its frontage is dressed. */
export const LandmarkKind = {
  BANK: 'BANK',
  MALL: 'MALL',
  OFFICE: 'OFFICE',
  CIVIC: 'CIVIC',
  HOTEL: 'HOTEL',
} as const

export type LandmarkKind = (typeof LandmarkKind)[keyof typeof LandmarkKind]

export interface Landmark {
  id: string
  /** As it appears on the building, in Latin script. */
  name: string
  /** As it appears above that, in Devanagari. */
  hi?: string
  kind: LandmarkKind
  /** Chainage of the centre of the plot, along the corridor. */
  x: number
  /** Which side of the line it stands on: +1 for +Z, -1 for -Z. */
  side: 1 | -1
  /** Frontage along the line, depth back from the footpath, and height. */
  width: number
  depth: number
  height: number
  /** How far back from the plot line the building stands, in metres. */
  setback?: number
  /** Wall colour. */
  wall: string
  /** Fascia colour the name is lettered on — the house colour, for a bank. */
  fascia: string
  /** Ink the name is lettered in. */
  ink?: string
}

/**
 * The character of a stretch of frontage: what the ordinary buildings between
 * the named ones are like.
 */
export interface District {
  id: string
  name: string
  from: number
  to: number
  /** Storeys, low and high. Frontage heights are drawn from between them. */
  minStoreys: number
  maxStoreys: number
  /** How much of the frontage is built on, 0 to 1. */
  density: number
  /** Trees per hundred metres of footpath. */
  trees: number
  /** Wall colours the frontage is drawn from. */
  palette: readonly string[]
}

const START = corridorStart(BLUE_CORRIDOR)
const END = corridorEnd(BLUE_CORRIDOR)

/** Delhi plaster and stone: ochre, sandstone, whitewash, weathered concrete. */
const DELHI_WALLS = [
  '#c9b79d',
  '#b8a184',
  '#d7c9b4',
  '#a8947a',
  '#cfc3ae',
  '#bfae95',
  '#9e8e78',
] as const

/** Central Delhi's colonnaded white, and the glass that has grown up behind it. */
const LUTYENS_WALLS = [
  '#e4dccb',
  '#ded5c2',
  '#cfc6b2',
  '#d9d0bd',
  '#c4bba8',
] as const

/** The commercial towers of the Barakhamba Road corridor. */
const OFFICE_WALLS = [
  '#9fa6ad',
  '#8d949c',
  '#b2b8bd',
  '#7f868d',
  '#a7aeb4',
  '#c2c7cb',
] as const

/**
 * The stretches the corridor runs through, end to end and in order.
 *
 * Every metre of the built line is inside exactly one of these, including
 * both tails: the tails are where trains appear and disappear, and a train
 * running out of an empty grey void would give the trick away.
 */
export const BLUE_DISTRICTS: readonly District[] = [
  {
    id: 'connaught-place',
    name: 'Connaught Place',
    from: START,
    to: 420,
    minStoreys: 3,
    maxStoreys: 7,
    density: 0.82,
    trees: 9,
    palette: LUTYENS_WALLS,
  },
  {
    id: 'barakhamba',
    name: 'Barakhamba Road',
    from: 420,
    to: 1420,
    minStoreys: 7,
    maxStoreys: 18,
    density: 0.72,
    trees: 7,
    palette: OFFICE_WALLS,
  },
  {
    id: 'mandi-house',
    name: 'Mandi House',
    from: 1420,
    to: 2300,
    minStoreys: 3,
    maxStoreys: 8,
    density: 0.62,
    trees: 12,
    palette: LUTYENS_WALLS,
  },
  {
    id: 'pragati-maidan',
    name: 'Pragati Maidan',
    from: 2300,
    to: 3500,
    minStoreys: 2,
    maxStoreys: 6,
    density: 0.4,
    trees: 14,
    palette: DELHI_WALLS,
  },
  {
    id: 'ip-estate',
    name: 'Indraprastha Estate',
    from: 3500,
    to: 4700,
    minStoreys: 5,
    maxStoreys: 14,
    density: 0.66,
    trees: 8,
    palette: OFFICE_WALLS,
  },
  {
    id: 'ring-road',
    name: 'Ring Road',
    from: 4700,
    to: 5600,
    minStoreys: 2,
    maxStoreys: 6,
    density: 0.48,
    trees: 10,
    palette: DELHI_WALLS,
  },
  {
    id: 'yamuna-bank',
    name: 'Yamuna Bank',
    from: 5600,
    to: END,
    minStoreys: 3,
    maxStoreys: 11,
    density: 0.55,
    trees: 11,
    palette: DELHI_WALLS,
  },
]

/**
 * The buildings that are actually there.
 *
 * Real places along this stretch of the real Blue Line, put at roughly their
 * real chainage: the banks and office towers of Barakhamba Road, the
 * theatres at Mandi House, Pragati Maidan and the Supreme Court beyond it,
 * the Secretariat at I P Estate. The two shopping centres are Delhi's, and
 * both are on this line.
 */
export const BLUE_LANDMARKS: readonly Landmark[] = [
  // --- Connaught Place -----------------------------------------------------
  {
    id: 'palika-bazaar',
    name: 'Palika Bazaar',
    hi: 'पालिका बाज़ार',
    kind: LandmarkKind.MALL,
    x: -180,
    side: -1,
    width: 88,
    depth: 44,
    height: 9,
    wall: '#d8cdb8',
    fascia: '#1f6f43',
  },
  {
    id: 'state-bank-of-india',
    name: 'State Bank of India',
    hi: 'भारतीय स्टेट बैंक',
    kind: LandmarkKind.BANK,
    x: -60,
    side: 1,
    width: 46,
    depth: 34,
    height: 24,
    wall: '#e0d8c7',
    fascia: '#1b4f9c',
  },
  {
    id: 'regal-building',
    name: 'Regal Building',
    hi: 'रीगल बिल्डिंग',
    kind: LandmarkKind.CIVIC,
    x: 90,
    side: -1,
    width: 62,
    depth: 30,
    height: 16,
    wall: '#e6ddcb',
    fascia: '#8c2f2a',
  },
  {
    id: 'punjab-national-bank',
    name: 'Punjab National Bank',
    hi: 'पंजाब नैशनल बैंक',
    kind: LandmarkKind.BANK,
    x: 210,
    side: 1,
    width: 40,
    depth: 30,
    height: 19,
    wall: '#ddd4c2',
    fascia: '#8f1d3c',
  },
  {
    id: 'jeevan-bharati',
    name: 'Jeevan Bharati Building',
    hi: 'जीवन भारती भवन',
    kind: LandmarkKind.OFFICE,
    x: 340,
    side: -1,
    width: 66,
    depth: 52,
    height: 58,
    wall: '#8e2f35',
    fascia: '#2d3c56',
  },

  // --- Barakhamba Road -----------------------------------------------------
  {
    id: 'statesman-house',
    name: 'Statesman House',
    hi: 'स्टेट्समैन हाउस',
    kind: LandmarkKind.OFFICE,
    x: 520,
    side: 1,
    width: 52,
    depth: 40,
    height: 52,
    wall: '#a3a9ae',
    fascia: '#33404d',
  },
  {
    id: 'hdfc-bank',
    name: 'HDFC Bank',
    hi: 'एचडीएफसी बैंक',
    kind: LandmarkKind.BANK,
    x: 640,
    side: -1,
    width: 38,
    depth: 32,
    height: 34,
    wall: '#b6bcc1',
    fascia: '#12457f',
  },
  {
    id: 'gopal-das-bhawan',
    name: 'Gopal Das Bhawan',
    hi: 'गोपाल दास भवन',
    kind: LandmarkKind.OFFICE,
    x: 860,
    side: 1,
    width: 58,
    depth: 44,
    height: 62,
    wall: '#98a0a7',
    fascia: '#3b4753',
  },
  {
    id: 'icici-bank',
    name: 'ICICI Bank',
    hi: 'आईसीआईसीआई बैंक',
    kind: LandmarkKind.BANK,
    x: 980,
    side: -1,
    width: 36,
    depth: 30,
    height: 28,
    wall: '#c0c5c9',
    fascia: '#b6551d',
  },
  {
    id: 'ambadeep',
    name: 'Ambadeep Building',
    hi: 'अंबदीप बिल्डिंग',
    kind: LandmarkKind.OFFICE,
    x: 1100,
    side: 1,
    width: 48,
    depth: 42,
    height: 66,
    wall: '#8f979f',
    fascia: '#2f3a45',
  },
  {
    id: 'axis-bank',
    name: 'Axis Bank',
    hi: 'ऐक्सिस बैंक',
    kind: LandmarkKind.BANK,
    x: 1220,
    side: -1,
    width: 34,
    depth: 28,
    height: 26,
    wall: '#bcc2c7',
    fascia: '#8b1f3f',
  },
  {
    id: 'bank-of-baroda',
    name: 'Bank of Baroda',
    hi: 'बैंक ऑफ़ बड़ौदा',
    kind: LandmarkKind.BANK,
    x: 1330,
    side: 1,
    width: 34,
    depth: 28,
    height: 22,
    wall: '#c8cdd1',
    fascia: '#e06522',
    ink: '#3a1c05',
  },

  // --- Mandi House ---------------------------------------------------------
  {
    id: 'doordarshan-bhawan',
    name: 'Doordarshan Bhawan',
    hi: 'दूरदर्शन भवन',
    kind: LandmarkKind.CIVIC,
    x: 1620,
    side: 1,
    width: 72,
    depth: 48,
    height: 30,
    wall: '#d5cab5',
    fascia: '#1d4c7a',
  },
  {
    id: 'kamani-auditorium',
    name: 'Kamani Auditorium',
    hi: 'कमानी सभागार',
    kind: LandmarkKind.CIVIC,
    x: 1770,
    side: -1,
    width: 54,
    depth: 40,
    height: 17,
    wall: '#c7a98a',
    fascia: '#6a2b2b',
  },
  {
    id: 'shri-ram-centre',
    name: 'Shri Ram Centre',
    hi: 'श्रीराम केंद्र',
    kind: LandmarkKind.CIVIC,
    x: 1880,
    side: 1,
    width: 46,
    depth: 38,
    height: 21,
    wall: '#b9a488',
    fascia: '#7a4a1d',
  },
  {
    id: 'triveni-kala-sangam',
    name: 'Triveni Kala Sangam',
    hi: 'त्रिवेणी कला संगम',
    kind: LandmarkKind.CIVIC,
    x: 2010,
    side: -1,
    width: 50,
    depth: 36,
    height: 14,
    wall: '#cdbda4',
    fascia: '#4d6b3a',
  },
  {
    id: 'ficci',
    name: 'FICCI',
    hi: 'फिक्की',
    kind: LandmarkKind.OFFICE,
    x: 2140,
    side: 1,
    width: 44,
    depth: 36,
    height: 26,
    wall: '#d2c8b3',
    fascia: '#274a76',
  },

  // --- Pragati Maidan and the Supreme Court --------------------------------
  {
    id: 'bharat-mandapam',
    name: 'Bharat Mandapam',
    hi: 'भारत मंडपम',
    kind: LandmarkKind.CIVIC,
    x: 2760,
    side: -1,
    width: 150,
    depth: 90,
    height: 34,
    setback: 14,
    wall: '#ddd2bd',
    fascia: '#7b5a1e',
  },
  {
    id: 'pragati-maidan',
    name: 'Pragati Maidan',
    hi: 'प्रगति मैदान',
    kind: LandmarkKind.CIVIC,
    x: 2980,
    side: -1,
    width: 110,
    depth: 70,
    height: 20,
    setback: 10,
    wall: '#cfc3ac',
    fascia: '#1f6f43',
  },
  {
    id: 'supreme-court',
    name: 'Supreme Court of India',
    hi: 'भारत का उच्चतम न्यायालय',
    kind: LandmarkKind.CIVIC,
    x: 3120,
    side: 1,
    width: 120,
    depth: 80,
    height: 32,
    setback: 18,
    wall: '#c6866a',
    fascia: '#5a2a18',
  },
  {
    id: 'national-stadium',
    name: 'Major Dhyan Chand Stadium',
    hi: 'मेजर ध्यानचंद स्टेडियम',
    kind: LandmarkKind.CIVIC,
    x: 3380,
    side: 1,
    width: 140,
    depth: 86,
    height: 24,
    setback: 12,
    wall: '#bfa07f',
    fascia: '#33506f',
  },

  // --- I P Estate and I T O ------------------------------------------------
  {
    id: 'ig-indoor-stadium',
    name: 'Indira Gandhi Indoor Stadium',
    hi: 'इंदिरा गांधी इंडोर स्टेडियम',
    kind: LandmarkKind.CIVIC,
    x: 3760,
    side: -1,
    width: 130,
    depth: 100,
    height: 30,
    setback: 16,
    wall: '#c5bda9',
    fascia: '#2b5b7d',
  },
  {
    id: 'delhi-secretariat',
    name: 'Delhi Secretariat',
    hi: 'दिल्ली सचिवालय',
    kind: LandmarkKind.CIVIC,
    x: 4020,
    side: 1,
    width: 96,
    depth: 56,
    height: 44,
    setback: 10,
    wall: '#d9cfb9',
    fascia: '#1f4f3a',
  },
  {
    id: 'canara-bank',
    name: 'Canara Bank',
    hi: 'केनरा बैंक',
    kind: LandmarkKind.BANK,
    x: 4260,
    side: -1,
    width: 34,
    depth: 28,
    height: 24,
    wall: '#c3c9ce',
    fascia: '#0f5aa0',
  },
  {
    id: 'ip-estate-towers',
    name: 'Indraprastha Estate',
    hi: 'इंद्रप्रस्थ एस्टेट',
    kind: LandmarkKind.OFFICE,
    x: 4420,
    side: 1,
    width: 56,
    depth: 44,
    height: 54,
    wall: '#969ea5',
    fascia: '#37424d',
  },
  {
    id: 'union-bank',
    name: 'Union Bank of India',
    hi: 'यूनियन बैंक ऑफ इंडिया',
    kind: LandmarkKind.BANK,
    x: 4560,
    side: -1,
    width: 32,
    depth: 26,
    height: 20,
    wall: '#c9ced2',
    fascia: '#9b1d3a',
  },

  // --- Ring Road and the river ---------------------------------------------
  {
    id: 'kotak-mahindra-bank',
    name: 'Kotak Mahindra Bank',
    hi: 'कोटक महिंद्रा बैंक',
    kind: LandmarkKind.BANK,
    x: 5060,
    side: 1,
    width: 30,
    depth: 26,
    height: 18,
    wall: '#cdd2d6',
    fascia: '#c2272d',
  },
  {
    id: 'v3s-mall',
    name: 'V3S East Centre Mall',
    hi: 'वी3एस ईस्ट सेंटर मॉल',
    kind: LandmarkKind.MALL,
    x: 5420,
    side: -1,
    width: 96,
    depth: 62,
    height: 26,
    wall: '#b9bec4',
    fascia: '#b8332f',
  },
  {
    id: 'indusind-bank',
    name: 'IndusInd Bank',
    hi: 'इंडसइंड बैंक',
    kind: LandmarkKind.BANK,
    x: 5640,
    side: 1,
    width: 30,
    depth: 26,
    height: 19,
    wall: '#c6ccd0',
    fascia: '#8c1a2c',
  },
  {
    id: 'cross-river-mall',
    name: 'Cross River Mall',
    hi: 'क्रॉस रिवर मॉल',
    kind: LandmarkKind.MALL,
    x: 6260,
    side: 1,
    width: 104,
    depth: 66,
    height: 28,
    wall: '#aeb4ba',
    fascia: '#1c6ea4',
  },
  {
    id: 'yamuna-bank-hotel',
    name: 'Hotel Yamuna View',
    hi: 'होटल यमुना व्यू',
    kind: LandmarkKind.HOTEL,
    x: 6480,
    side: -1,
    width: 40,
    depth: 34,
    height: 38,
    wall: '#cdbfa6',
    fascia: '#2f5d7c',
  },
]

/** The district a chainage falls in, or the nearest one at the ends. */
export function districtAt(x: number): District {
  const found = BLUE_DISTRICTS.find((district) => x >= district.from && x < district.to)
  if (found) return found

  const first = BLUE_DISTRICTS[0]
  const last = BLUE_DISTRICTS.at(-1)
  if (!first || !last) throw new Error('The corridor has no districts')

  return x < first.from ? first : last
}

/** Every landmark whose plot overlaps a stretch of the corridor. */
export function landmarksBetween(from: number, to: number): Landmark[] {
  return BLUE_LANDMARKS.filter(
    (landmark) => landmark.x + landmark.width / 2 > from && landmark.x - landmark.width / 2 < to,
  )
}
