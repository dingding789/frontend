// Shims for modules lacking TypeScript declarations
declare module 'pako' {
  export function inflate(data: Uint8Array | ArrayLike<number>, options?: any): Uint8Array;
}
declare module '@kitware/vtk.js/Filters/General/WarpScalar';
declare module '@kitware/vtk.js/Filters/Core/PolyDataNormals';
declare module '@kitware/vtk.js/IO/Legacy/PolyDataReader';
