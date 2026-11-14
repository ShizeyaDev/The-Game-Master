import { type RollResult, type RunSummary } from './types.ts';

// Version-pinned 165-option schema used by 7 Days to Die V3.4. Revalidate the
// keys, defaults, and value indexes before advertising support for a later game version.

interface SandboxSchemaOption {
  name: string;
  key: string;
  defaultIndex: number;
  values: string[];
}

export interface SandboxCodeOmission {
  resultIndex: number;
  categoryName: string;
  optionLabel: string;
  reason: string;
}

export interface SandboxCodeGeneration {
  version: '3.4';
  code: string;
  handledResultIndexes: ReadonlySet<number>;
  encodedOptionCount: number;
  omissions: SandboxCodeOmission[];
}

const SANDBOX_SCHEMA_V34: readonly SandboxSchemaOption[] = [{"name":"RangedDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"AA"},{"name":"MeleeDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"AB"},{"name":"BlockDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"AC"},{"name":"TerrainDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"AD"},{"name":"HeadshotMultiplier","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"AE"},{"name":"CrouchSpeed","defaultIndex":7,"values":["None","25%","50%","60.000004%","70%","80%","90%","100% (default)","110%","120.00001%","130%","140%","150%","200%","300%"],"key":"AF"},{"name":"WalkSpeed","defaultIndex":6,"values":["25%","50%","60.000004%","70%","80%","90%","100% (default)","110%","120.00001%","130%","140%","150%","200%","300%"],"key":"AG"},{"name":"RunSpeed","defaultIndex":7,"values":["None","25%","50%","60.000004%","70%","80%","90%","100% (default)","110%","120.00001%","130%","140%","150%","200%","300%"],"key":"AH"},{"name":"JumpStrength","defaultIndex":2,"values":["None","50%","100% (default)","125%","150%","200%","300%"],"key":"AI"},{"name":"StaminaUsage","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","175%","200%"],"key":"AJ"},{"name":"StaminaRegen","defaultIndex":3,"values":["25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"AK"},{"name":"PlayerLevelBonusApplied","defaultIndex":1,"values":["No","Yes (default)"],"key":"AL"},{"name":"JarRefund","defaultIndex":7,"values":["None","5%","10%","20%","30.000002%","40%","50%","60.000004% (default)","70%","80%","90%","100%"],"key":"AM"},{"name":"ShowHealthBars","defaultIndex":0,"values":["No (default)","Yes"],"key":"AN"},{"name":"ShowEnemyDamage","defaultIndex":0,"values":["No (default)","Yes"],"key":"AO"},{"name":"NewbieCoat","defaultIndex":1,"values":["No","Yes (default)"],"key":"AP"},{"name":"HeadshotMode","defaultIndex":0,"values":["None (default)","Headshot Only","Headshot Finisher"],"key":"AQ"},{"name":"IncomingDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"AR"},{"name":"XPMultiplier","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","175%","200%","300%","500%"],"key":"AS"},{"name":"ShowXP","defaultIndex":0,"values":["All (default)","Bar Only","Notifications Only","None"],"key":"AT"},{"name":"EncumbranceModifier","defaultIndex":2,"values":["Disabled","Low","Default","High","Very High","Full"],"key":"AU"},{"name":"ItemDegradation","defaultIndex":3,"values":["Disabled","Very Low","Low","Default","High","Very High"],"key":"AV"},{"name":"LoseItemsOnDeathType","defaultIndex":0,"values":["None (default)","All","Toolbelt Only","Backpack Only","Equipment","Carried Only"],"key":"AW"},{"name":"LoseItemsOnDeathCount","defaultIndex":0,"values":["1-3 (default)","1-5","1-10","1-20","3-5","5-7","5-10","7-10","10-15","15-20"],"key":"AX"},{"name":"DegradeItemsOnDeath","defaultIndex":0,"values":["None (default)","Durability","Max Durability","Both"],"key":"AY"},{"name":"DegradeAmountOnDeath","defaultIndex":2,"values":["None","5%","10% (default)","15.000001%","20%","25%"],"key":"AZ"},{"name":"DeathPenalty","defaultIndex":1,"values":["None","XP Only (default)","Injured","Permanent Death"],"key":"BA"},{"name":"DropOnDeath","defaultIndex":1,"values":["None","All (default)","Toolbelt Only","Backpack Only","Equipment","Carried Only","Delete All"],"key":"BB"},{"name":"DropOnQuit","defaultIndex":0,"values":["None (default)","All","Toolbelt Only","Backpack Only","Equipment","Carried Only"],"key":"BC"},{"name":"InfectionRate","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"BD"},{"name":"EnemySpawnMode","defaultIndex":1,"values":["No","Yes (default)"],"key":"BE"},{"name":"EntityDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"BF"},{"name":"BlockDamageAI","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"BG"},{"name":"BlockDamageAIBM","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"BH"},{"name":"ZombieMove","defaultIndex":0,"values":["Walk (default)","Jog","Run","Sprint","Nightmare"],"key":"BI"},{"name":"ZombieMoveNight","defaultIndex":3,"values":["Walk","Jog","Run","Sprint (default)","Nightmare"],"key":"BJ"},{"name":"ZombieFeralMove","defaultIndex":3,"values":["Walk","Jog","Run","Sprint (default)","Nightmare"],"key":"BK"},{"name":"ZombieBMMove","defaultIndex":3,"values":["Walk","Jog","Run","Sprint (default)","Nightmare"],"key":"BL"},{"name":"ZombieFeralSense","defaultIndex":0,"values":["Disabled (default)","Day","Night","All"],"key":"BM"},{"name":"AISmellMode","defaultIndex":3,"values":["None","Walk","Jog","Run (default)","Sprint","Nightmare"],"key":"BN"},{"name":"AllowZombieDigging","defaultIndex":1,"values":["No","Yes (default)"],"key":"BO"},{"name":"ZombieRageChance","defaultIndex":1,"values":["None","15.000001% (default)","30.000002%","35%","40%","50%","60.000004%","75%","90%","100%"],"key":"BP"},{"name":"EntityIncomingDamage","defaultIndex":6,"values":["25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"BQ"},{"name":"MaxEnemyTier","defaultIndex":5,"values":["Normals","Strongs","Specials","Ferals","Radiated","Elites (default)"],"key":"BR"},{"name":"BiomeDayZombieRespawn","defaultIndex":0,"values":["Default","Very Slow","Slow","Normal","Fast","Very Fast"],"key":"BS"},{"name":"BiomeDayAnimalRespawn","defaultIndex":0,"values":["Default","Very Slow","Slow","Normal","Fast","Very Fast"],"key":"BT"},{"name":"BiomeDayEnemyDensity","defaultIndex":1,"values":["None","Default","Very Low","Low","Medium","High","Very High"],"key":"BU"},{"name":"ZombiesEatAnimals","defaultIndex":1,"values":["No","Yes (default)"],"key":"BV"},{"name":"BloodMoonFrequency","defaultIndex":7,"values":["Disabled","1 Day","2 Days","3 Days","4 Days","5 Days","6 Days","7 Days (default)","8 Days","9 Days","10 Days","14 Days","20 Days","30 Days"],"key":"BW"},{"name":"BloodMoonRange","defaultIndex":0,"values":["0 Days (default)","1 Day","2 Days","3 Days","4 Days","7 Days","10 Days","14 Days","20 Days"],"key":"BX"},{"name":"BloodMoonWarning","defaultIndex":1,"values":["Disabled","Morning (default)","Evening"],"key":"BY"},{"name":"BloodMoonEnemyCount","defaultIndex":2,"values":["4 Enemies","6 Enemies","8 Enemies (default)","10 Enemies","12 Enemies","16 Enemies","24 Enemies","32 Enemies","64 Enemies"],"key":"BZ"},{"name":"AirDropFrequency","defaultIndex":3,"values":["Disabled","Every Day","1-3 Days","3 Days (default)","3-7 Days","7 Days","1-7 Days"],"key":"CA"},{"name":"AirDropMarker","defaultIndex":1,"values":["No","Yes (default)"],"key":"CB"},{"name":"AirDropRandomTime","defaultIndex":0,"values":["None (default)","Morning","Mid Day","Evening","Night","All Day","Any"],"key":"CC"},{"name":"BiomeProgression","defaultIndex":1,"values":["No","Yes (default)"],"key":"CD"},{"name":"TemperatureSurvival","defaultIndex":1,"values":["No","Yes (default)"],"key":"CE"},{"name":"StormFreq","defaultIndex":2,"values":["None","50%","100% (default)","150%","200%","300%","400%","500%"],"key":"CF"},{"name":"StormWarning","defaultIndex":1,"values":["No","Yes (default)"],"key":"CG"},{"name":"HeatMapSensitivity","defaultIndex":3,"values":["Disabled","Very Low","Low","Default","High","Very High"],"key":"CH"},{"name":"GlobalGSModifier","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"CI"},{"name":"BiomeGSModifier","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"CJ"},{"name":"GlobalLSModifier","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"CK"},{"name":"BiomeLSModifier","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"CL"},{"name":"POITierLSModifier","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"CM"},{"name":"GlobalTSModifier","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"CN"},{"name":"DayNightLength","defaultIndex":5,"values":["10","20","30","40","50","60 (default)","90","120"],"key":"CO"},{"name":"DayLightLength","defaultIndex":8,"values":["Always Night","4","6","8","10","12","14","16","18 (default)","20","Always Day"],"key":"CP"},{"name":"AllowMap","defaultIndex":1,"values":["No","Yes (default)"],"key":"CQ"},{"name":"AllowCompass","defaultIndex":1,"values":["No","Yes (default)"],"key":"CR"},{"name":"AllowScreenMarkers","defaultIndex":1,"values":["No","Yes (default)"],"key":"CS"},{"name":"ShowLocationInfo","defaultIndex":1,"values":["No","Yes (default)","Name Only"],"key":"CT"},{"name":"ShowDayTime","defaultIndex":1,"values":["No","Yes (default)"],"key":"CU"},{"name":"WorkstationsInTheWild","defaultIndex":0,"values":["None (default)","5%","10%","20%","30.000002%","40%","50%","60.000004%","70%","80%","90%","100%"],"key":"CV"},{"name":"MaxTechType","defaultIndex":4,"values":["None","Tech 0","Tech 1","Tech 2","Tech 3 (default)"],"key":"CW"},{"name":"LootRespawnDays","defaultIndex":2,"values":["Disabled","5","7 (default)","10","15","20","30","40","50"],"key":"CX"},{"name":"LootTimer","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"CY"},{"name":"LootMaxTier","defaultIndex":0,"values":["Default","1","2","3","4","5","6"],"key":"CZ"},{"name":"GlobalLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DA"},{"name":"FoodLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DB"},{"name":"DrinkLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DC"},{"name":"MedicalLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DD"},{"name":"AmmoLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DE"},{"name":"ResourceLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DF"},{"name":"ArmorLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DG"},{"name":"MeleeLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DH"},{"name":"RangedLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DI"},{"name":"DukesLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DJ"},{"name":"CraftingMagazinesLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DK"},{"name":"TreasureMapChance","defaultIndex":7,"values":["None","25%","50%","60.000004%","70%","80%","90%","100% (default)","110%","120.00001%","130%","140%","150%","200%","300%"],"key":"DL"},{"name":"LootBagChance","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DM"},{"name":"CropOutput","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DN"},{"name":"SeedDropOutput","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DO"},{"name":"CropGrowthSpeed","defaultIndex":5,"values":["None","Instant","20%","50%","75%","100% (default)","150%","200%","300%"],"key":"DP"},{"name":"BackpackCrafting","defaultIndex":1,"values":["No","Yes (default)","Limited","Workbench Only"],"key":"DQ"},{"name":"WorkstationCrafting","defaultIndex":1,"values":["No","Yes (default)"],"key":"DR"},{"name":"CraftingProgression","defaultIndex":1,"values":["No","Yes (default)"],"key":"DS"},{"name":"CraftingTime","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"DT"},{"name":"CraftingInput","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"DU"},{"name":"CraftingOutput","defaultIndex":3,"values":["25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"DV"},{"name":"CraftingMaxTier","defaultIndex":0,"values":["Default","1","2","3","4","5","6"],"key":"DW"},{"name":"MiningOutput","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DX"},{"name":"HarvestingOutput","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"DY"},{"name":"ScrappingOutput","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"DZ"},{"name":"SmeltingType","defaultIndex":0,"values":["Smelter (default)","Recipes"],"key":"EA"},{"name":"DewCollectorTime","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"EB"},{"name":"DewCollectorOutput","defaultIndex":0,"values":["100% (default)","200%","300%","400%","500%"],"key":"EC"},{"name":"DewCollectorInput","defaultIndex":1,"values":["None","100% (default)","200%","300%"],"key":"ED"},{"name":"ApiaryTime","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"EE"},{"name":"ApiaryOutput","defaultIndex":0,"values":["100% (default)","200%","300%","400%","500%"],"key":"EF"},{"name":"ApiaryInput","defaultIndex":5,"values":["None","20%","40%","60.000004%","80%","100% (default)","150%","200%","300%"],"key":"EG"},{"name":"BookLootCount","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","300%","400%","500%"],"key":"EH"},{"name":"CrouchRunSpeed","defaultIndex":7,"values":["None","25%","50%","60.000004%","70%","80%","90%","100% (default)","110%","120.00001%","130%","140%","150%","200%","300%"],"key":"EI"},{"name":"RepairTypes","defaultIndex":3,"values":["None","Repair Only","Combine Only","Both (default)"],"key":"EJ"},{"name":"MaxDegradationAmount","defaultIndex":0,"values":["None (default)","5%","10%","15.000001%","20%","25%"],"key":"EK"},{"name":"PointsPerMagazine","defaultIndex":1,"values":["None","1 (default)","2","3","4","5","6","7"],"key":"EL"},{"name":"SkillGainRate","defaultIndex":0,"values":["1 (default)","2","3","4","5"],"key":"EM"},{"name":"SkillPointsPerLevel","defaultIndex":1,"values":["None","1 (default)","2","3","4","5","6","7"],"key":"EN"},{"name":"QuestsEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EO"},{"name":"IntroQuestEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EP"},{"name":"TraderToTraderQuestsEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EQ"},{"name":"StarterSkillPoints","defaultIndex":4,"values":["None","1","2","3","4 (default)","5","6","7","8","9","10"],"key":"ER"},{"name":"QuestsPerTier","defaultIndex":10,"values":["None","1","2","3","4","5","6","7","8","9","10 (default)","11","12","13","14","15"],"key":"ES"},{"name":"QuestProgressionDailyLimit","defaultIndex":4,"values":["Unlimited","1","2","3","4 (default)","5","6","7","8","9","10"],"key":"ET"},{"name":"BuriedQuestsEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EU"},{"name":"POIQuestsEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EV"},{"name":"TraderDialog","defaultIndex":1,"values":["No","Yes (default)"],"key":"EW"},{"name":"TraderHours","defaultIndex":0,"values":["Default","Morning","Mid Day","Evening","Night","BM Closed","Always Open"],"key":"EX"},{"name":"TradersEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EY"},{"name":"VendingEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"EZ"},{"name":"TraderSellPrices","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","175%","200%","300%","400%"],"key":"FA"},{"name":"TraderBuyPrices","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","175%","200%","300%","400%"],"key":"FB"},{"name":"TraderProtection","defaultIndex":0,"values":["Yes (default)","Claimable","Not Claimable"],"key":"FC"},{"name":"TraderResetInterval","defaultIndex":0,"values":["Default","1 Day","2 Days","3 Days","4 Days","5 Days","6 Days","7 Days","14 Days"],"key":"FD"},{"name":"TraderItemAbundance","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"FE"},{"name":"TraderBuyLimit","defaultIndex":3,"values":["None","1","2","3 (default)","4","5","6","7","8","9","10"],"key":"FF"},{"name":"TraderMaxTier","defaultIndex":0,"values":["Default","1","2","3","4","5","6"],"key":"FG"},{"name":"VendingResetInterval","defaultIndex":0,"values":["Default","1 Day","2 Days","3 Days","4 Days","5 Days","6 Days","7 Days","14 Days"],"key":"FH"},{"name":"VendingItemAbundance","defaultIndex":2,"values":["Very Low","Low","Default","High","Very High"],"key":"FI"},{"name":"ChallengesEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"FJ"},{"name":"IntroChallengesEnabled","defaultIndex":1,"values":["No","Yes (default)"],"key":"FK"},{"name":"VehicleFuelUsage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"FL"},{"name":"VehicleEntityDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"FM"},{"name":"VehicleBlockDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"FN"},{"name":"VehicleSelfDamage","defaultIndex":7,"values":["None","25%","35%","50%","65%","75%","85%","100% (default)","125%","150%","200%","250%","300%"],"key":"FO"},{"name":"ElectricalOutput","defaultIndex":3,"values":["25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"FP"},{"name":"SillyCelebrate","defaultIndex":0,"values":["No (default)","Yes","Headshot Only"],"key":"FQ"},{"name":"SillyBigHeads","defaultIndex":0,"values":["No (default)","Yes"],"key":"FR"},{"name":"SillyTinyZombies","defaultIndex":0,"values":["No (default)","Yes"],"key":"FS"},{"name":"SillySounds","defaultIndex":0,"values":["No (default)","Yes"],"key":"FT"},{"name":"SillyLowGravity","defaultIndex":5,"values":["50%","60.000004%","70%","80%","90%","100% (default)"],"key":"FU"},{"name":"SillyBlackandWhite","defaultIndex":0,"values":["No (default)","Yes"],"key":"FV"},{"name":"ChickenCoopTime","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"FW"},{"name":"ChickenCoopOutput","defaultIndex":0,"values":["100% (default)","200%","300%","400%","500%"],"key":"FX"},{"name":"ChickenCoopInput","defaultIndex":5,"values":["None","20%","40%","60.000004%","80%","100% (default)","150%","200%","300%"],"key":"FY"},{"name":"BiomeDayAnimalDensity","defaultIndex":1,"values":["None","Default","Very Low","Low","Medium","High","Very High"],"key":"FZ"},{"name":"BiomeNightZombieRespawn","defaultIndex":0,"values":["Default","Very Slow","Slow","Normal","Fast","Very Fast"],"key":"GA"},{"name":"BiomeNightAnimalRespawn","defaultIndex":0,"values":["Default","Very Slow","Slow","Normal","Fast","Very Fast"],"key":"GB"},{"name":"BiomeNightEnemyDensity","defaultIndex":1,"values":["None","Default","Very Low","Low","Medium","High","Very High"],"key":"GC"},{"name":"BiomeNightAnimalDensity","defaultIndex":1,"values":["None","Default","Very Low","Low","Medium","High","Very High"],"key":"GD"},{"name":"InfectionChance","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","200%","300%"],"key":"GE"},{"name":"HungerMultiplier","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","175%","200%"],"key":"GF"},{"name":"ThirstMultiplier","defaultIndex":4,"values":["None","25%","50%","75%","100% (default)","125%","150%","175%","200%"],"key":"GG"},{"name":"StackSizeMultiplier","defaultIndex":3,"values":["25%","50%","75%","100% (default)","125%","150%","175%","200%","250%","300%","400%","500%"],"key":"GH"},{"name":"FullChickenStressEvent","defaultIndex":1,"values":["None","Random (default)","Chicken Drop","Angry Chicken","Zombie Horde","Murder Chickens"],"key":"GI"}];

const CATEGORY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "playerdamageinincoming": [
    "IncomingDamage"
  ],
  "skillgainamount": [
    "SkillGainRate"
  ],
  "levelstatbonus": [
    "PlayerLevelBonusApplied"
  ],
  "newplayerbuffnewbiecoat": [
    "NewbieCoat"
  ],
  "encumbranceslots": [
    "EncumbranceModifier"
  ],
  "loseondeathdropondeath": [
    "LoseItemsOnDeathType"
  ],
  "deathlosscount": [
    "LoseItemsOnDeathCount"
  ],
  "deathdegradation": [
    "DegradeItemsOnDeath"
  ],
  "deathdegradationamount": [
    "DegradeAmountOnDeath"
  ],
  "enemyspawning": [
    "EnemySpawnMode"
  ],
  "enemydensityday": [
    "BiomeDayEnemyDensity"
  ],
  "enemydensitynight": [
    "BiomeNightEnemyDensity"
  ],
  "animaldensityday": [
    "BiomeDayAnimalDensity"
  ],
  "animaldensitynight": [
    "BiomeNightAnimalDensity"
  ],
  "enemyrespawnday": [
    "BiomeDayZombieRespawn"
  ],
  "enemyrespawnnight": [
    "BiomeNightZombieRespawn"
  ],
  "biomeanimalrespawnday": [
    "BiomeDayAnimalRespawn"
  ],
  "biomeanimalrespawnnight": [
    "BiomeNightAnimalRespawn"
  ],
  "zombiedayspeed": [
    "ZombieMove"
  ],
  "zombienightspeed": [
    "ZombieMoveNight"
  ],
  "zombieferalspeed": [
    "ZombieFeralMove"
  ],
  "zombiebloodmoonspeed": [
    "ZombieBMMove"
  ],
  "zombierage": [
    "ZombieRageChance"
  ],
  "zombiedigging": [
    "AllowZombieDigging"
  ],
  "24hourcycle": [
    "DayNightLength"
  ],
  "bloodmooncount": [
    "BloodMoonEnemyCount"
  ],
  "stormfrequency": [
    "StormFreq"
  ],
  "airdrops": [
    "AirDropFrequency"
  ],
  "lootabundance": [
    "GlobalLootCount"
  ],
  "foodlootabundance": [
    "FoodLootCount"
  ],
  "medicallootabundance": [
    "MedicalLootCount"
  ],
  "meleelootabundance": [
    "MeleeLootCount"
  ],
  "rangedlootabundance": [
    "RangedLootCount"
  ],
  "armorlootabundance": [
    "ArmorLootCount"
  ],
  "ammolootabundance": [
    "AmmoLootCount"
  ],
  "magazinesbookslootabundance": [
    "CraftingMagazinesLootCount",
    "BookLootCount"
  ],
  "materialslootabundance": [
    "ResourceLootCount"
  ],
  "maxlootquality": [
    "LootMaxTier"
  ],
  "globallootstage": [
    "GlobalLSModifier"
  ],
  "biomelootstage": [
    "BiomeLSModifier"
  ],
  "lootbagdroprate": [
    "LootBagChance"
  ],
  "loottimersearchspeed": [
    "LootTimer"
  ],
  "miningyield": [
    "MiningOutput"
  ],
  "resourceyield": [
    "HarvestingOutput"
  ],
  "cropyield": [
    "CropOutput"
  ],
  "seeddroprate": [
    "SeedDropOutput"
  ],
  "craftingtimer": [
    "CraftingTime"
  ],
  "craftingyield": [
    "CraftingOutput"
  ],
  "craftingcost": [
    "CraftingInput"
  ],
  "repairmethod": [
    "RepairTypes"
  ],
  "dewcollectoryield": [
    "DewCollectorOutput"
  ],
  "apiaryyield": [
    "ApiaryOutput"
  ],
  "chickencoopyield": [
    "ChickenCoopOutput"
  ],
  "tradingenabled": [
    "TradersEnabled"
  ],
  "traderitemcount": [
    "TraderItemAbundance"
  ],
  "traderrestockfrequency": [
    "TraderResetInterval"
  ],
  "buyprice": [
    "TraderBuyPrices"
  ],
  "sellprice": [
    "TraderSellPrices"
  ],
  "vendingreset": [
    "VendingResetInterval"
  ],
  "questspoiquests": [
    "POIQuestsEnabled"
  ],
  "questsperdaytierlimit": [
    "QuestProgressionDailyLimit"
  ],
  "introchallenges": [
    "IntroChallengesEnabled"
  ],
  "introquests": [
    "IntroQuestEnabled"
  ],
  "baseskillpoints": [
    "StarterSkillPoints"
  ],
  "traderoutes": [
    "TraderToTraderQuestsEnabled"
  ],
  "vehiclesafedamage": [
    "VehicleSelfDamage"
  ],
  "gravity": [
    "SillyLowGravity"
  ]
};

function normalizeName(value: string): string {
  return value.replace(/^\[[^\]]+\]\s*/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizeValue(value: string): string {
  return value
    .replace(/\(default\)/gi, '')
    .replace(/(\d+)\.\d+(?=%)/g, (_match, whole: string) => whole)
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function firstInteger(value: string): number | null {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Math.round(Number(match[0])) : null;
}

const SCHEMA_BY_NAME = new Map(SANDBOX_SCHEMA_V34.map((option) => [option.name, option]));
const SCHEMA_NAME_BY_NORMALIZED_NAME = new Map(
  SANDBOX_SCHEMA_V34.map((option) => [normalizeName(option.name), option.name])
);

function resolveSchemaNames(categoryName: string): readonly string[] {
  const normalized = normalizeName(categoryName);
  const aliased = CATEGORY_ALIASES[normalized];
  if (aliased) {
    return aliased;
  }
  const direct = SCHEMA_NAME_BY_NORMALIZED_NAME.get(normalized);
  return direct ? [direct] : [];
}

function resolveValueIndex(option: SandboxSchemaOption, label: string): number | null {
  const normalizedLabel = normalizeValue(label);
  const exactIndex = option.values.findIndex((candidate) => normalizeValue(candidate) === normalizedLabel);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const synonyms: Readonly<Record<string, readonly string[]>> = {
    nothing: ['none'],
    none0: ['none'],
    '0': ['none'],
    everything: ['all'],
    off: ['disabled', 'none'],
    normal: ['none', 'default'],
    disabled: ['none'],
    '247': ['alwaysopen'],
    default06052150: ['default'],
    instant0: ['none']
  };
  const synonymCandidates = synonyms[normalizedLabel] ?? [];
  for (const synonym of synonymCandidates) {
    const synonymIndex = option.values.findIndex(
      (candidate) => normalizeValue(candidate) === synonym
    );
    if (synonymIndex >= 0) {
      return synonymIndex;
    }
  }

  const numericValue = firstInteger(label);
  if (numericValue !== null) {
    const numericMatches = option.values
      .map((candidate, index) => ({ index, numericValue: firstInteger(candidate) }))
      .filter((candidate) => candidate.numericValue === numericValue);
    if (numericMatches.length === 1) {
      return numericMatches[0].index;
    }
  }

  return null;
}

function is7DaysToDieSummary(summary: Pick<RunSummary, 'gameTitle'>): boolean {
  return normalizeName(summary.gameTitle).includes('7daystodie');
}

export function generate7DaysToDieSandboxCode(
  summary: Pick<RunSummary, 'gameTitle' | 'results'>
): SandboxCodeGeneration | null {
  if (!is7DaysToDieSummary(summary)) {
    return null;
  }

  const encodedByKey = new Map<string, number>();
  const handledResultIndexes = new Set<number>();
  const omissions: SandboxCodeOmission[] = [];

  summary.results.forEach((result: RollResult, resultIndex) => {
    const schemaNames = resolveSchemaNames(result.categoryName);
    if (schemaNames.length === 0) {
      omissions.push({
        resultIndex,
        categoryName: result.categoryName,
        optionLabel: result.selectedOption.label,
        reason: 'This decision is not part of SandboxCode and must be applied manually.'
      });
      return;
    }

    const resolved = schemaNames.map((schemaName) => {
      const option = SCHEMA_BY_NAME.get(schemaName);
      if (!option) {
        return null;
      }
      const valueIndex = resolveValueIndex(option, result.selectedOption.label);
      return valueIndex === null ? null : { option, valueIndex };
    });

    if (resolved.some((item) => item === null)) {
      omissions.push({
        resultIndex,
        categoryName: result.categoryName,
        optionLabel: result.selectedOption.label,
        reason: 'The selected value does not exist in the V3.4 Sandbox option schema.'
      });
      return;
    }

    handledResultIndexes.add(resultIndex);
    resolved.forEach((item) => {
      if (item && item.valueIndex !== item.option.defaultIndex) {
        encodedByKey.set(item.option.key, item.valueIndex);
      }
    });
  });

  const blocks = [...encodedByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, valueIndex]) => `${key}${String.fromCharCode(65 + valueIndex)}`);

  return {
    version: '3.4',
    code: `A${blocks.join('')}`,
    handledResultIndexes,
    encodedOptionCount: blocks.length,
    omissions
  };
}

