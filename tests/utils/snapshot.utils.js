// Permite comparar el snapshot entero con un solo toEqual, cuyo diff nombra TODOS los campos que fallaron.
export const omitKeys = (snapshot, ignoredKeys = []) =>
  Object.fromEntries(Object.entries(snapshot).filter(([key]) => !ignoredKeys.includes(key)));
