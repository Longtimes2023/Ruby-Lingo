import type { EvolutionStage, PetType } from '@shared/types/reward.js';

const PET_ARTWORK: Record<PetType, Record<EvolutionStage, string>> = {
  monkey: {
    baby: '/assets/pets/monkey-baby.webp',
    adult: '/assets/pets/monkey-adult.webp',
    super: '/assets/pets/monkey-super.webp',
  },
  cat: {
    baby: '/assets/pets/cat-baby.webp',
    adult: '/assets/pets/cat-adult.webp',
    super: '/assets/pets/cat-super.webp',
  },
  dog: {
    baby: '/assets/pets/dog-baby.webp',
    adult: '/assets/pets/dog-adult.webp',
    super: '/assets/pets/dog-super.webp',
  },
  tiger: {
    baby: '/assets/pets/tiger-baby.webp',
    adult: '/assets/pets/tiger-adult.webp',
    super: '/assets/pets/tiger-super.webp',
  },
  pig: {
    baby: '/assets/pets/pig-baby.webp',
    adult: '/assets/pets/pig-adult.webp',
    super: '/assets/pets/pig-super.webp',
  },
  dragon: {
    baby: '/assets/pets/dragon-baby.webp',
    adult: '/assets/pets/dragon-adult.webp',
    super: '/assets/pets/dragon-super.webp',
  },
};

export function petArtworkUrl(
  petType: PetType,
  evolutionStage: EvolutionStage,
): string | undefined {
  return PET_ARTWORK[petType]?.[evolutionStage];
}
