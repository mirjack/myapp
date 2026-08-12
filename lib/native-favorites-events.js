const listeners = new Set();

export function emitFavoriteChanged({ productId, isFavorite, product }) {
  const normalizedProductId = String(productId ?? product?.id ?? "");
  if (!normalizedProductId) return;

  const event = {
    productId: normalizedProductId,
    isFavorite: Boolean(isFavorite),
    product: product
      ? {
          ...product,
          id: String(product.id ?? normalizedProductId),
          is_favorite: Boolean(isFavorite),
          isFavorite: Boolean(isFavorite),
        }
      : null,
  };

  listeners.forEach((listener) => listener(event));
}

export function subscribeFavoriteChanges(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
