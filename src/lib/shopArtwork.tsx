import type { ShopItem } from '@shared/types/reward.js';

import { shopArtworkOf } from './shopArtworkManifest.js';

export function ShopArtwork({
  item,
  className,
}: {
  item: Pick<ShopItem, 'id' | 'icon'>;
  className?: string;
}) {
  const src = shopArtworkOf(item);
  if (!src) return <span aria-hidden="true">{item.icon}</span>;

  return (
    <>
      <img
        src={src}
        alt=""
        draggable={false}
        className={className}
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.nextElementSibling?.removeAttribute('hidden');
        }}
      />
      <span hidden aria-hidden="true">
        {item.icon}
      </span>
    </>
  );
}
