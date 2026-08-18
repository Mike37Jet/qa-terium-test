// Rutas de la app. Si /pedidos o /ordenes se renombran, se toca solo aquí.
export const ROUTE = {
  login: '/login',
  orders: '/ordenes',
  indents: '/pedidos',
};

export const createPath = (base) => `${base}/create`;
export const editPath = (base, id) => `${base}/${id}/edit`;
export const listPagePath = (base, pageNum) => `${base}?page=${pageNum}`;
// Mismo parámetro que la app usa en el enlace del aviso "Orden N creada".
export const listSearchPath = (base, query) => `${base}?cadenaBusqueda=${encodeURIComponent(query)}`;

const escapeForRegExp = (path) => path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Derivados de la misma base que el goto, para que un renombre no deje la espera en la ruta vieja.
export const urlPattern = {
  page: (path) => new RegExp(`${escapeForRegExp(path)}(?:$|[/?#])`),
  list: (base) => new RegExp(`${escapeForRegExp(base)}(?:[?#]|$)`),
  listPage: (base, pageNum) => new RegExp(`${escapeForRegExp(listPagePath(base, pageNum))}`),
  edit: (base) => new RegExp(`${escapeForRegExp(base)}\\/\\d+\\/edit(?:$|[/?#])`),
};
