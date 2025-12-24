// VTU reader using vtkXMLReader (auto-handles binary, zlib, endianness)
// Reference: frd-viewer's vtkVtuReader.js
// Returns: vtkPolyData with surface geometry and scalars

import vtkXMLReader from '@kitware/vtk.js/IO/XML/XMLReader.js';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkCellArray from '@kitware/vtk.js/Common/Core/CellArray';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';

export async function parseVtuToPolyData(arrayBuffer: ArrayBuffer): Promise<vtkPolyData> {
  if (!arrayBuffer) throw new Error('VTU buffer is empty');

  const reader = createUnstructuredGridReader();
  const ok = reader.parseAsArrayBuffer(arrayBuffer);
  if (!ok) throw new Error('VTK XML parse failed');

  const output = reader.getOutputData(0);
  if (!output) throw new Error('VTU parse returned no output');

  console.log('[VTU] parseVtuToPolyData completed');
  return output;
}

/**
 * Create an UnstructuredGrid reader using vtkXMLReader
 * vtkXMLReader.processDataArray handles binary + zlib decompression automatically
 */
function createUnstructuredGridReader() {
  const publicAPI = {} as any;
  const model = { output: [] as any[] };

  // Extend from vtkXMLReader (auto-handles binary, zlib, endianness)
  vtkXMLReader.extend(publicAPI, model, { dataType: 'UnstructuredGrid' });

  publicAPI.getOutputData = (idx = 0) => model.output[idx];

  publicAPI.parseXML = (
    rootElem: Element,
    type: string,
    compressor: string,
    byteOrder: string,
    headerType: string
  ) => {
    console.log('[VTU] parseXML called, type:', type, 'compressor:', compressor);

    // 1. Find UnstructuredGrid/Piece
    const datasetElem = rootElem.getElementsByTagName(type)[0];
    if (!datasetElem) throw new Error('VTU missing UnstructuredGrid root');

    const piece = datasetElem.getElementsByTagName('Piece')[0];
    if (!piece) throw new Error('VTU missing Piece element');

    const nbPoints = Number(piece.getAttribute('NumberOfPoints') || '0');
    const nbCells = Number(piece.getAttribute('NumberOfCells') || '0');
    console.log(`[VTU] parseXML: points=${nbPoints}, cells=${nbCells}`);

    // 2. Parse Points using vtkXMLReader.processDataArray (handles binary/zlib)
    const pointsElem = piece.getElementsByTagName('Points')[0];
    const pointsArrayElem = pointsElem?.getElementsByTagName('DataArray')[0];
    const pointArray = pointsArrayElem
      ? (vtkXMLReader.processDataArray as any)(
          nbPoints,
          pointsArrayElem as any,
          compressor,
          byteOrder,
          headerType,
          (model as any).binaryBuffer
        )
      : { values: new Float32Array(0), numberOfComponents: 3 };

    console.log(
      `[VTU] Points parsed: ${pointArray.values.length} values, ${pointArray.numberOfComponents} components`
    );

    const coords = new Float32Array(nbPoints * 3);
    for (let i = 0; i < nbPoints; i++) {
      const base = i * pointArray.numberOfComponents;
      coords[i * 3] = pointArray.values[base] || 0;
      coords[i * 3 + 1] = pointArray.values[base + 1] || 0;
      coords[i * 3 + 2] = pointArray.values[base + 2] || 0;
    }

    // 3. Parse Cells (connectivity, offsets, types) using processCells
    const cellsElem = piece.getElementsByTagName('Cells')[0];
    const polys: number[] = [];
    const elementTypes: number[] = [];

    if (cellsElem && nbCells > 0) {
      // processCells handles connectivity + offsets into a flat array
      const cellValues = (vtkXMLReader.processCells as any)(
        nbCells,
        cellsElem as any,
        compressor,
        byteOrder,
        headerType,
        (model as any).binaryBuffer
      );

      // Extract types (used for surface extraction)
      const typeArrayElem = getDataArrayByName(cellsElem, 'types');
      const typeArray = typeArrayElem
        ? (vtkXMLReader.processDataArray as any)(
            nbCells,
            typeArrayElem as any,
            compressor,
            byteOrder,
            headerType,
            (model as any).binaryBuffer
          )
        : { values: new Uint8Array(nbCells) };

      // Rebuild cells from cellValues and extract surface polys
      const surfaceTriFaces: Record<string, [number, number, number]> = {};
      const surfaceQuadFaces: Record<string, [number, number, number, number]> = {};

      let offset = 0;
      for (let cellIdx = 0; cellIdx < nbCells; cellIdx++) {
        const npts = cellValues[offset];
        offset += 1;
        const ids: number[] = [];
        for (let j = 0; j < npts; j++, offset++) {
          ids.push(Number(cellValues[offset]));
        }
        const cellType = Number(typeArray.values[cellIdx]) || 0;
        elementTypes.push(cellType);

        // Surface extraction for 2D and 3D cells
        if (cellType === 5 || cellType === 7) {
          // VTK_TRIANGLE or VTK_POLYGON (2D)
          if (npts === 3) {
            polys.push(3, ids[0], ids[1], ids[2]);
          } else if (npts === 4) {
            polys.push(4, ids[0], ids[1], ids[2], ids[3]);
          } else if (npts > 3) {
            // Fan triangulation for polygon
            for (let k = 1; k < npts - 1; k++) {
              polys.push(3, ids[0], ids[k], ids[k + 1]);
            }
          }
        } else if (cellType === 9) {
          // VTK_QUAD (2D)
          if (npts === 4) {
            polys.push(4, ids[0], ids[1], ids[2], ids[3]);
          }
        } else if (cellType === 10) {
          // VTK_TETRA (3D)
          if (npts === 4) {
            addTriIfNew(surfaceTriFaces, ids[0], ids[1], ids[2]);
            addTriIfNew(surfaceTriFaces, ids[0], ids[1], ids[3]);
            addTriIfNew(surfaceTriFaces, ids[0], ids[2], ids[3]);
            addTriIfNew(surfaceTriFaces, ids[1], ids[2], ids[3]);
          }
        } else if (cellType === 12) {
          // VTK_HEXAHEDRON (3D)
          if (npts === 8) {
            addQuadIfNew(surfaceQuadFaces, ids[0], ids[1], ids[2], ids[3]);
            addQuadIfNew(surfaceQuadFaces, ids[4], ids[5], ids[6], ids[7]);
            addQuadIfNew(surfaceQuadFaces, ids[0], ids[1], ids[5], ids[4]);
            addQuadIfNew(surfaceQuadFaces, ids[1], ids[2], ids[6], ids[5]);
            addQuadIfNew(surfaceQuadFaces, ids[2], ids[3], ids[7], ids[6]);
            addQuadIfNew(surfaceQuadFaces, ids[3], ids[0], ids[4], ids[7]);
          }
        } else if (cellType === 13) {
          // VTK_WEDGE (3D)
          if (npts === 6) {
            addTriIfNew(surfaceTriFaces, ids[0], ids[1], ids[2]);
            addTriIfNew(surfaceTriFaces, ids[3], ids[4], ids[5]);
            addQuadIfNew(surfaceQuadFaces, ids[0], ids[1], ids[4], ids[3]);
            addQuadIfNew(surfaceQuadFaces, ids[1], ids[2], ids[5], ids[4]);
            addQuadIfNew(surfaceQuadFaces, ids[2], ids[0], ids[3], ids[5]);
          }
        } else if (cellType === 14) {
          // VTK_PYRAMID (3D)
          if (npts === 5) {
            addQuadIfNew(surfaceQuadFaces, ids[0], ids[1], ids[2], ids[3]);
            addTriIfNew(surfaceTriFaces, ids[0], ids[1], ids[4]);
            addTriIfNew(surfaceTriFaces, ids[1], ids[2], ids[4]);
            addTriIfNew(surfaceTriFaces, ids[2], ids[3], ids[4]);
            addTriIfNew(surfaceTriFaces, ids[3], ids[0], ids[4]);
          }
        }
      }

      // Add extracted surface faces to polys
      for (const key in surfaceTriFaces) {
        const ids = surfaceTriFaces[key];
        polys.push(3, ids[0], ids[1], ids[2]);
      }
      for (const key in surfaceQuadFaces) {
        const ids = surfaceQuadFaces[key];
        polys.push(4, ids[0], ids[1], ids[2], ids[3]);
      }

      console.log(`[VTU] Cells parsed: ${polys.length} poly entries`);
    }

    // 4. Parse PointData (scalars)
    let scalars: Float32Array | null = null;
    let activeName = 'Displacement';
    const pointDataElem = piece.getElementsByTagName('PointData')[0];

    if (pointDataElem) {
      const dataArrays = pointDataElem.getElementsByTagName('DataArray');
      console.log(`[VTU] PointData has ${dataArrays.length} DataArrays`);

      for (let idx = 0; idx < dataArrays.length; idx++) {
        const arrElem = dataArrays[idx];
        const arrName = arrElem.getAttribute('Name') || `array_${idx}`;
        const numComponents = Number(arrElem.getAttribute('NumberOfComponents') || '1');
        console.log(`[VTU] PointData[${idx}]: Name="${arrName}", Components=${numComponents}`);

        if (arrName === 'Displacement') {
          const arrData = (vtkXMLReader.processDataArray as any)(
            nbPoints,
            arrElem as any,
            compressor,
            byteOrder,
            headerType,
            (model as any).binaryBuffer
          );

          if (numComponents === 1) {
            // Scalar displacement data - use directly
            scalars = new Float32Array(arrData.values);
            activeName = 'Displacement';
            const minVal = Math.min(...Array.from(scalars));
            const maxVal = Math.max(...Array.from(scalars));
            console.log(`[VTU] Using Displacement (scalar) as scalars, range: [${minVal}, ${maxVal}]`);
          } else if (numComponents === 3) {
            // Vector displacement - compute magnitude
            const magnitude = new Float32Array(nbPoints);
            for (let i = 0; i < nbPoints; i++) {
              const base = i * 3;
              const dx = Number(arrData.values[base]) || 0;
              const dy = Number(arrData.values[base + 1]) || 0;
              const dz = Number(arrData.values[base + 2]) || 0;
              magnitude[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            scalars = magnitude;
            activeName = 'Displacement_magnitude';
            const minVal = Math.min(...Array.from(magnitude));
            const maxVal = Math.max(...Array.from(magnitude));
            console.log(
              `[VTU] Using Displacement (vector) magnitude as scalars, range: [${minVal}, ${maxVal}]`
            );
          }
          break;
        }
      }
    }

    // Fallback: if no scalars, use index-based coloring
    if (!scalars) {
      console.log('[VTU] No Displacement data found, using index-based coloring');
      scalars = new Float32Array(nbPoints);
      for (let i = 0; i < nbPoints; i++) {
        scalars[i] = i / nbPoints;
      }
    }

    // 5. Build vtkPolyData
    const polyData = vtkPolyData.newInstance();
    const points = vtkPoints.newInstance({ numberOfComponents: 3 });
    points.setData(coords, 3);
    polyData.setPoints(points);

    // Set polys
    if (polys.length > 0) {
      const polysData = new Uint32Array(polys);
      const cellArray = vtkCellArray.newInstance();
      cellArray.setData(polysData);
      polyData.setPolys(cellArray);
      const nPolyCells = countPolyCells(polys);
      console.log(`[VTU] Polys set: ${polys.length} entries, ${nPolyCells} cells`);
    } else {
      console.warn('[VTU] No polys generated, mesh will be points only');
    }

    // Set scalars
    const scalarArray = vtkDataArray.newInstance({
      numberOfComponents: 1,
      values: scalars,
      name: activeName,
    });
    polyData.getPointData().setScalars(scalarArray);
    const scalarMin = Math.min(...Array.from(scalars));
    const scalarMax = Math.max(...Array.from(scalars));
    console.log(`[VTU] Scalars set: ${activeName}, range [${scalarMin}, ${scalarMax}]`);

    console.log('[VTU] Final polyData:', {
      points: polyData.getNumberOfPoints(),
      polys: polyData.getNumberOfPolys(),
      scalars: !!polyData.getPointData().getScalars(),
    });

    model.output[0] = polyData;
  };

  return publicAPI;
}

// Helpers
function addTriIfNew(map: Record<string, [number, number, number]>, a: number, b: number, c: number) {
  const key = [a, b, c].sort((x, y) => x - y).join('_');
  if (!map[key]) {
    map[key] = [a, b, c];
  }
}

function addQuadIfNew(
  map: Record<string, [number, number, number, number]>,
  a: number,
  b: number,
  c: number,
  d: number
) {
  const key = [a, b, c, d].sort((x, y) => x - y).join('_');
  if (!map[key]) {
    map[key] = [a, b, c, d];
  }
}

function getDataArrayByName(containerElem: Element | null, name: string): Element | null {
  if (!containerElem) return null;
  const arrays = containerElem.getElementsByTagName('DataArray');
  for (let i = 0; i < arrays.length; i++) {
    if ((arrays[i].getAttribute('Name') || '').toLowerCase() === name.toLowerCase()) {
      return arrays[i];
    }
  }
  return null;
}

function countPolyCells(polys: number[]): number {
  let count = 0;
  let i = 0;
  while (i < polys.length) {
    const npts = polys[i];
    i += npts + 1;
    count++;
  }
  return count;
}
