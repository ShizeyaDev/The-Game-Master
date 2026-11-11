export const DEFAULT_SEED_BUNDLE             = {
  id: 'seed-elden-ring-cursed-v1',
  title: 'Elden Ring: Sovereign Arbiter Protocol',
  description:
    'Strict non-negotiable challenge parameters for the Lands Between. Dictates starting lineage, weapon constraints, combat restrictions, healing allowances, and spirit ash regulations.',
  createdAt: 1730000000000,
  updatedAt: 1730000000000,
  categories: [
    {
      id: 'cat-starting-lineage',
      name: 'Starting Lineage',
      options: [
        { id: 'opt-lineage-vagabond', label: 'Vagabond (Standard Knight Kit)', rank: 'F' },
        { id: 'opt-lineage-samurai', label: 'Samurai (Uchigatana & Longbow)', rank: 'E' },
        { id: 'opt-lineage-astrologer', label: 'Astrologer (Glintstone Sorcery)', rank: 'E' },
        { id: 'opt-lineage-confessor', label: 'Confessor (Broadsword & Incantations)', rank: 'D' },
        { id: 'opt-lineage-prisoner', label: 'Prisoner (Estoc & Magic Glintblade)', rank: 'D' },
        { id: 'opt-lineage-bandit', label: 'Bandit (Great Knife & Buckler Parries)', rank: 'C' },
        { id: 'opt-lineage-wretch', label: 'Wretch (Rune Level 1, Club Only Start)', rank: 'A' },
      ],
    },
    {
      id: 'cat-armament-doctrine',
      name: 'Armament Doctrine',
      options: [
        { id: 'opt-arm-unrestricted', label: 'Unrestricted Arsenal (Any Weapon & Upgrade)', rank: 'F' },
        { id: 'opt-arm-heavy-iron', label: 'Colossal & Great Weapons Only (No Shields)', rank: 'D' },
        { id: 'opt-arm-paired-steel', label: 'Dual-Wield Powerstance Only (No Blocking)', rank: 'C' },
        { id: 'opt-arm-starting-gear', label: 'Starting Equipment Lock (Upgrades Permitted)', rank: 'B' },
        { id: 'opt-arm-unupgraded', label: 'Smithing Prohibition (+0 Base Weapons Only)', rank: 'A' },
        { id: 'opt-arm-torches-flails', label: 'Torches, Crossbows, and Shields Only', rank: 'S' },
      ],
    },
    {
      id: 'cat-crimson-rationing',
      name: 'Crimson Tear Rationing',
      options: [
        { id: 'opt-heal-full', label: 'Full Sacred Flask Allocation', rank: 'F' },
        { id: 'opt-heal-capped-five', label: 'Maximum 5 Crimson Flasks Equipped', rank: 'D' },
        { id: 'opt-heal-physick-incant', label: 'Wondrous Physick & Healing Incantations Only', rank: 'B' },
        { id: 'opt-heal-grace-only', label: 'Zero Combat Healing (Sites of Grace Only)', rank: 'S' },
      ],
    },
    {
      id: 'cat-spirit-invocation',
      name: 'Spirit Calling Verdict',
      options: [
        { id: 'opt-spirit-any', label: 'All Spirit Ashes Permitted (Including Mimic Tear)', rank: 'F' },
        { id: 'opt-spirit-standard', label: 'Non-Elite Spirit Ashes Only (No Named/Legendary)', rank: 'D' },
        { id: 'opt-spirit-unupgraded', label: 'Base Level (+0) Spirit Ashes Only', rank: 'C' },
        { id: 'opt-spirit-solitary', label: 'Solitary Sovereign (Zero Summons or Spirit Ashes)', rank: 'B' },
      ],
    },
    {
      id: 'cat-mortality-clause',
      name: 'Mortality & Rune Clause',
      options: [
        { id: 'opt-mort-standard', label: 'Standard Recovery (Retrieve Runes on Death)', rank: 'F' },
        { id: 'opt-mort-forfeit', label: 'Blood Tax (Never Recover Dropped Runes)', rank: 'C' },
        { id: 'opt-mort-region-lock', label: 'Region Exile (Death Resets Current Legacy Dungeon)', rank: 'A' },
        { id: 'opt-mort-permadeath', label: 'Iron Verdict (Single Death Terminates Run)', rank: 'S' },
      ],
    },
  ],
};

export function createDefaultSeedBundle()             {
  return JSON.parse(JSON.stringify(DEFAULT_SEED_BUNDLE))              ;
}
