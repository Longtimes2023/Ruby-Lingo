const ARTWORK: Readonly<Record<string, string>> = {
  'acc-bow': '/assets/pets/shop/acc-bow.webp',
  'acc-hat': '/assets/pets/shop/acc-hat.webp',
  'acc-glasses': '/assets/pets/shop/acc-glasses.webp',
  'acc-star-glasses': '/assets/pets/shop/acc-star-glasses.webp',
  'acc-scarf': '/assets/pets/shop/acc-scarf.webp',
  'acc-shoes': '/assets/pets/shop/acc-shoes.webp',
  'acc-backpack': '/assets/pets/shop/acc-backpack.webp',
  'acc-crown': '/assets/pets/shop/acc-crown.webp',
  'acc-cape': '/assets/pets/shop/acc-cape.webp',
  'acc-wings': '/assets/pets/shop/acc-wings.webp',
  'dec-balloon': '/assets/pets/shop/dec-balloon.webp',
  'dec-plant': '/assets/pets/shop/dec-plant.webp',
  'dec-lantern': '/assets/pets/shop/dec-lantern.webp',
  'dec-picture': '/assets/pets/shop/dec-picture.webp',
  'dec-rainbow': '/assets/pets/shop/dec-rainbow.webp',
  'dec-sunflower': '/assets/pets/shop/dec-sunflower.webp',
  'dec-flag': '/assets/pets/shop/dec-flag.webp',
  'dec-treehouse': '/assets/pets/shop/dec-treehouse.webp',
  'dec-aquarium': '/assets/pets/shop/dec-aquarium.webp',
  'dec-castle': '/assets/pets/shop/dec-castle.webp',
};

export function shopArtworkOf(item: { id: string }): string | undefined {
  return ARTWORK[item.id];
}
