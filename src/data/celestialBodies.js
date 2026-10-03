import { solarSystemBodies } from "../astro/solarSystem";

const DEEP_SKY = [
  { id: "dso-m31", name: "the Andromeda Galaxy", kind: "galaxy", ra: 10.685, dec: 41.269, vmag: 3.4 },
  { id: "dso-m42", name: "the Orion Nebula", kind: "nebula", ra: 83.822, dec: -5.391, vmag: 4.0 },
  { id: "dso-m45", name: "the Pleiades", kind: "cluster", ra: 56.871, dec: 24.105, vmag: 1.6 },
  { id: "dso-m44", name: "the Beehive Cluster", kind: "cluster", ra: 130.1, dec: 19.67, vmag: 3.7 },
  { id: "dso-m13", name: "the Hercules Cluster", kind: "cluster", ra: 250.423, dec: 36.460, vmag: 5.8 },
  { id: "dso-m7", name: "Ptolemy's Cluster", kind: "cluster", ra: 268.46, dec: -34.79, vmag: 3.3 },
  { id: "dso-m8", name: "the Lagoon Nebula", kind: "nebula", ra: 270.92, dec: -24.38, vmag: 6.0 },
  { id: "dso-m22", name: "Messier 22", kind: "cluster", ra: 279.1, dec: -23.9, vmag: 5.1 },
  { id: "dso-m57", name: "the Ring Nebula", kind: "nebula", ra: 283.396, dec: 33.029, vmag: 8.8 },
  { id: "dso-hyades", name: "the Hyades", kind: "cluster", ra: 66.75, dec: 15.87, vmag: 0.5 },
  { id: "dso-lmc", name: "the Large Magellanic Cloud", kind: "galaxy", ra: 80.89, dec: -69.76, vmag: 0.9 },
  { id: "dso-smc", name: "the Small Magellanic Cloud", kind: "galaxy", ra: 13.16, dec: -72.80, vmag: 2.7 },
  { id: "dso-omega-cen", name: "Omega Centauri", kind: "cluster", ra: 201.697, dec: -47.480, vmag: 3.9 },
];

const FACTS = {
  "the Sun": "The Sun is a G-type star so close that its light takes only eight minutes to reach us.",
  "the Moon": "The Moon is slowly drifting away from Earth by about 3.8 centimeters each year.",
  Mercury: "Mercury has almost no atmosphere, so its day side and night side differ by hundreds of degrees.",
  Venus: "Venus spins backwards compared with most planets, so the Sun rises in the west there.",
  Mars: "Mars is rust-red because its dust is rich in iron oxide.",
  Jupiter: "Jupiter is so large that more than 1,300 Earths could fit inside it.",
  Saturn: "Saturn is the only planet in the Solar System that would float in a big enough bathtub — it is less dense than water.",
  Uranus: "Uranus rolls on its side, so its poles take turns pointing almost straight at the Sun.",
  Neptune: "Neptune's winds are the fastest in the Solar System, topping 1,200 miles per hour.",
  "the Andromeda Galaxy": "Andromeda is on a long collision course with the Milky Way; they will merge in about 4 billion years.",
  "the Orion Nebula": "The Orion Nebula is a stellar nursery about 1,300 light-years away, visible to the naked eye as the sword of Orion.",
  "the Pleiades": "Many cultures saw the Pleiades as seven sisters; the cluster is only about 100 million years old.",
  "the Beehive Cluster": "The Beehive is one of the nearest open clusters, sitting in Cancer like a faint swarm of bees.",
  "the Hercules Cluster": "Messier 13 holds several hundred thousand stars in a ball about 22,000 light-years away.",
  "Ptolemy's Cluster": "Ptolemy recorded this bright southern cluster in the 2nd century, long before telescopes.",
  "the Lagoon Nebula": "The Lagoon Nebula is one of the few star-forming clouds you can glimpse without a telescope.",
  "Messier 22": "Messier 22 is one of the brightest globular clusters and was among the first ever discovered.",
  "the Ring Nebula": "The Ring Nebula is a dying star's cast-off shell, seen almost face-on like a smoke ring.",
  "the Hyades": "The Hyades form the V-shaped face of Taurus and are the nearest open cluster to Earth.",
  "the Large Magellanic Cloud": "The LMC is a satellite galaxy of the Milky Way and hosted the famous supernova SN 1987A.",
  "the Small Magellanic Cloud": "The SMC is an irregular dwarf galaxy that has been dancing with the LMC for billions of years.",
  "Omega Centauri": "Omega Centauri may be the leftover core of a small galaxy the Milky Way once swallowed.",
  Sirius: "Sirius is the brightest star in the night sky and has a white-dwarf companion the size of Earth.",
  Betelgeuse: "Betelgeuse is a red supergiant so large that if it replaced the Sun it would swallow Jupiter's orbit.",
  Rigel: "Rigel is a blue-white powerhouse shining tens of thousands of times brighter than the Sun.",
  Vega: "Vega was the northern pole star about 14,000 years ago and will be again in the distant future.",
  Polaris: "Polaris sits close to the north celestial pole, so the whole sky appears to wheel around it.",
  Capella: "Capella is actually a pair of giant yellow stars locked in a close orbit.",
  Arcturus: "Arcturus is an aging orange giant racing through the galaxy on an unusual orbit.",
  Antares: "Antares is a red supergiant whose name means 'rival of Mars' because of its similar color.",
  Altair: "Altair spins so quickly that it is noticeably flattened at the poles.",
  Deneb: "Deneb is so luminous that it would outshine most of the stars you can see if it were as close as Vega.",
  Spica: "Spica is a tight pair of hot blue stars that eclipse and distort each other.",
  Aldebaran: "Aldebaran is an orange giant that marks the fiery eye of Taurus, just in front of the Hyades.",
  Procyon: "Procyon is one of the Sun's nearer neighbors and hides a faint white-dwarf companion.",
  "Alpha Centauri": "Alpha Centauri is the nearest star system to the Sun, just over four light-years away.",
  Canopus: "Canopus is the second-brightest star in the night sky and a long-time navigation beacon.",
  Achernar: "Achernar spins so fast it is one of the most flattened stars known.",
  Fomalhaut: "Fomalhaut is a young star with a dusty debris disk, sometimes called the Loneliest Star.",
  Regulus: "Regulus sits almost on the ecliptic, so the Moon and planets often pass close by.",
  Castor: "Castor is a six-star system that looks like a single bright point to the eye.",
  Pollux: "Pollux is an orange giant and the brighter of the Gemini twins.",
  Algol: "Algol is an eclipsing binary that noticeably dims every few days, the original 'demon star'.",
  Mira: "Mira was the first variable star recognized, fading and brightening over a slow 11-month pulse.",
  Alpheratz: "Alpheratz is shared by Andromeda and Pegasus, sitting at the corner of the Great Square.",
  Caph: "Caph is one of the bright stars that sketch the W of Cassiopeia.",
};

const GENERIC_FACTS = {
  star: "Even a modest night-sky star is a distant sun, often many light-years away.",
  planet: "Planets do not make their own light; they shine by reflecting the Sun.",
  moon: "Moons are natural satellites, locked in orbit around a planet.",
  galaxy: "A galaxy is a city of stars, gas, and dark matter bound together by gravity.",
  nebula: "Nebulae are clouds of gas and dust — some birth new stars, others are the leftovers of old ones.",
  cluster: "Star clusters are siblings: they formed together from the same cloud.",
  sun: "Every sunlit day on Earth is starlight from our own star.",
};

export function factFor(body) {
  if (!body) return "";
  return FACTS[body.name] || GENERIC_FACTS[body.kind] || GENERIC_FACTS.star;
}

export function catalogId(body) {
  return body?.id ?? body?.hip ?? `${body?.kind ?? "body"}-${body?.name ?? "unknown"}`;
}

/** Planets, the Moon, the Sun, and bright deep-sky objects, then the star catalog. */
export function skyBodiesAt(date, stars) {
  return [
    ...solarSystemBodies(date).map((body) => ({ ...body, fact: factFor(body) })),
    ...DEEP_SKY.map((body) => ({ ...body, fact: factFor(body) })),
    ...stars,
  ];
}

export function displayName(body) {
  if (body?.name) return body.name;
  if (body?.hip) return `HIP ${body.hip}`;
  return "an unnamed star";
}

export const KIND_LABELS = {
  star: "Star",
  planet: "Planet",
  moon: "Moon",
  sun: "Star",
  galaxy: "Galaxy",
  nebula: "Nebula",
  cluster: "Cluster",
};

export function inspectableBodies(date, stars) {
  return [
    ...solarSystemBodies(date),
    ...DEEP_SKY,
    ...stars,
  ];
}
