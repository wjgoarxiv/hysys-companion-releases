export const EXAMPLE_CATEGORIES = ["gas", "refining", "refrigeration", "separation", "heat", "compression", "reaction", "teaching"] as const;
export type ExampleCategory = (typeof EXAMPLE_CATEGORIES)[number];
export type WordsExample = { id: string; category: ExampleCategory; ko: string; en: string; baseCase?: boolean };

export const WORDS_EXAMPLES: readonly WordsExample[] = [
  { id: "lng-regas", category: "gas", ko: "LNG를 해수로 기화해서 송출하는 공정 만들어줘", en: "Build an LNG regasification process using seawater" },
  { id: "gas-chill", category: "gas", ko: "천연가스를 냉각해 중질 성분을 분리하는 공정 만들어줘", en: "Build a process that chills natural gas and drops out the heavy ends" },
  { id: "bog-reliq", category: "gas", ko: "LNG 저장탱크 증발가스(BOG)를 압축해 재액화하는 공정 만들어줘", en: "Build a BOG compression and reliquefaction process for an LNG tank" },
  { id: "jt-letdown", category: "gas", ko: "가스를 밸브로 감압해 줄-톰슨 냉각하는 공정 만들어줘", en: "Build a JT valve process that cools gas by letting its pressure down" },

  { id: "crude-flash", category: "refining", ko: "원유를 가열하고 분리기로 가스와 액체를 나누는 공정 만들어줘", en: "Build a process that heats crude and splits gas from liquid in a separator" },
  { id: "crude-stab", category: "refining", ko: "고압·저압 분리기 두 단으로 원유를 안정화하는 공정 만들어줘", en: "Build a two-stage HP/LP separator crude stabilisation process" },
  { id: "naphtha-heat", category: "refining", ko: "나프타를 가열로에서 데운 뒤 냉각하는 공정 만들어줘", en: "Build a process that heats naphtha in a fired heater, then cools it" },
  { id: "c3-splitter", category: "refining", ko: "프로필렌과 프로판 분리탑을 만들어줘", en: "Build a propylene-propane splitter", baseCase: true },

  { id: "c3-refrig", category: "refrigeration", ko: "프로판 냉동 사이클을 만들어줘", en: "Build a propane refrigeration cycle" },
  { id: "c2-refrig", category: "refrigeration", ko: "에틸렌 냉동 사이클을 만들어줘", en: "Build an ethylene refrigeration cycle" },
  { id: "n2-expander", category: "refrigeration", ko: "질소 팽창 사이클로 가스를 액화하는 공정 만들어줘", en: "Build a nitrogen expander cycle that liquefies gas" },
  { id: "mr-lng", category: "refrigeration", ko: "혼합냉매로 천연가스를 -160도까지 냉각하는 공정 만들어줘", en: "Build a mixed-refrigerant process that cools natural gas to -160 C" },

  { id: "two-phase", category: "separation", ko: "기액 분리기 하나로 가스와 액체를 나누는 공정 만들어줘", en: "Build a process with one gas-liquid separator" },
  { id: "three-phase", category: "separation", ko: "3상 분리기로 가스, 기름, 물을 나누는 공정 만들어줘", en: "Build a three-phase separator for gas, oil and water" },
  { id: "dehydration", category: "separation", ko: "천연가스 탈수 패키지를 만들어줘", en: "Build a natural-gas dehydration package", baseCase: true },
  { id: "knockout", category: "separation", ko: "가스를 냉각한 뒤 플래시 드럼으로 응축수를 빼는 공정 만들어줘", en: "Build a process that cools gas and knocks out condensate in a flash drum" },

  { id: "water-cooler", category: "heat", ko: "물을 40도로 식히는 냉각기 공정 만들어줘", en: "Build a cooler that cools water to 40 C" },
  { id: "feed-effluent", category: "heat", ko: "뜨거운 제품으로 차가운 원료를 데우는 열교환기 공정 만들어줘", en: "Build a heat exchanger where the hot product warms the cold feed" },
  { id: "steam-heater", category: "heat", ko: "증기로 원료를 150도까지 가열하는 공정 만들어줘", en: "Build a process that heats the feed to 150 C with steam" },
  { id: "cw-loop", category: "heat", ko: "냉각수 순환 루프를 만들어줘", en: "Build a cooling water loop" },

  { id: "comp-train", category: "compression", ko: "가스를 3단 압축하고 단마다 냉각하는 공정 만들어줘", en: "Build a three-stage compressor train with intercoolers" },
  { id: "water-pump", category: "compression", ko: "물을 펌프로 10 bar까지 올리는 공정 만들어줘", en: "Build a pump that raises water to 10 bar" },
  { id: "anti-surge", category: "compression", ko: "압축기 출구 일부를 입구로 되돌리는 리사이클 공정 만들어줘", en: "Build a compressor with a recycle from its outlet back to its inlet" },
  { id: "split-mix", category: "compression", ko: "원료를 두 갈래로 나눴다가 다시 합치는 공정 만들어줘", en: "Build a process that splits the feed in two and mixes it back" },

  { id: "methanol", category: "reaction", ko: "메탄올 합성 반응기 공정 만들어줘", en: "Build a methanol synthesis reactor process", baseCase: true },
  { id: "smr", category: "reaction", ko: "수증기 메탄 개질 반응기 공정 만들어줘", en: "Build a steam methane reforming reactor process", baseCase: true },
  { id: "ammonia", category: "reaction", ko: "암모니아 합성 루프를 만들어줘", en: "Build an ammonia synthesis loop", baseCase: true },
  { id: "ethane-crack", category: "reaction", ko: "전환율 반응기로 에탄을 분해하는 공정 만들어줘", en: "Build a conversion reactor that cracks ethane", baseCase: true },

  { id: "one-heater", category: "teaching", ko: "가열기 하나로 물을 데우는 가장 간단한 공정 만들어줘", en: "Build the simplest process: one heater warming water" },
  { id: "two-feed-mix", category: "teaching", ko: "두 원료를 혼합기로 섞는 공정 만들어줘", en: "Build a mixer that blends two feeds" },
  { id: "valve-flash", category: "teaching", ko: "밸브로 압력을 낮추고 분리기로 나누는 공정 만들어줘", en: "Build a valve letdown followed by a separator" },
  { id: "heat-sep-cool", category: "teaching", ko: "가열, 분리, 냉각을 차례로 하는 공정 만들어줘", en: "Build a heat, separate, cool sequence" },
];

export function filterExamples(query: string, category: ExampleCategory, examples: readonly WordsExample[] = WORDS_EXAMPLES): WordsExample[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return examples.filter((example) => example.category === category);
  return examples.filter((example) => {
    const text = `${example.ko} ${example.en}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
