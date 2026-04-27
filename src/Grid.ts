import type { Coord, TerrainTypeId } from './types';
import { TERRAIN_TYPES } from './data/terrainTypes';

/**
 * 六角格設定（pointy-top, odd-r offset）
 *
 * Coord {x, y} 解讀為 (col, row) 的 offset 座標。
 * 奇數列（y%2 === 1）向右偏移半個 hex 寬。
 *
 * 內部數學使用 cube 座標（{x,y,z} where x+y+z=0）轉換。
 */
export const HEX_SIZE = 40; // hex 半徑（中心 → 頂點）
export const HEX_W = Math.sqrt(3) * HEX_SIZE; // ≈ 69.28
export const HEX_H = 2 * HEX_SIZE; // 80
export const HEX_V_SPACING = HEX_H * 0.75; // 60，每列垂直距離

export const BOARD_OFFSET_X = 60;
export const BOARD_OFFSET_Y = 80;

/** 為向後相容，TILE_SIZE 取為 hex 寬（unit 視覺尺寸基準）*/
export const TILE_SIZE = HEX_W;

let _gridWidth = 8;
let _gridHeight = 8;
let _terrain: TerrainTypeId[][] = [];

export function setGridSize(w: number, h: number): void {
  _gridWidth = w;
  _gridHeight = h;
}

export function setTerrain(grid: TerrainTypeId[][]): void {
  _terrain = grid;
}

export function getGridWidth(): number {
  return _gridWidth;
}

export function getGridHeight(): number {
  return _gridHeight;
}

export function boardWidthPx(): number {
  // 偶數列從 0；奇數列偏移半 hex；總寬 = (cols + 0.5) * HEX_W
  return HEX_W * (_gridWidth + 0.5);
}

export function boardHeightPx(): number {
  return HEX_V_SPACING * (_gridHeight - 1) + HEX_H;
}

export function getTerrainAt(coord: Coord): TerrainTypeId {
  if (!inBounds(coord)) return 'plain';
  return _terrain[coord.y]?.[coord.x] ?? 'plain';
}

/** 六角格中心 pixel 位置（pointy-top, odd-r offset） */
export function hexCenterPx(coord: Coord): { x: number; y: number } {
  const offsetX = (coord.y & 1) === 1 ? HEX_W / 2 : 0;
  return {
    x: BOARD_OFFSET_X + HEX_W / 2 + coord.x * HEX_W + offsetX,
    y: BOARD_OFFSET_Y + HEX_SIZE + coord.y * HEX_V_SPACING,
  };
}

/** 別名：tileToPixel 與 hexCenterPx 同義（向後相容）*/
export const tileToPixel = hexCenterPx;

/** Pixel → offset hex coord（pointy-top, odd-r）；越界回 null */
export function pixelToTile(px: number, py: number): Coord | null {
  const localX = px - BOARD_OFFSET_X - HEX_W / 2;
  const localY = py - BOARD_OFFSET_Y - HEX_SIZE;
  const size = HEX_SIZE;

  // 轉 fractional axial（pointy-top）
  const q = ((Math.sqrt(3) / 3) * localX - (1 / 3) * localY) / size;
  const r = ((2 / 3) * localY) / size;

  // 轉 cube 並 round
  let cx = q;
  let cz = r;
  let cy = -cx - cz;

  let rx = Math.round(cx);
  let ry = Math.round(cy);
  let rz = Math.round(cz);

  const dx = Math.abs(rx - cx);
  const dy = Math.abs(ry - cy);
  const dz = Math.abs(rz - cz);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;

  // cube → offset (odd-r)
  const col = rx + (rz - (rz & 1)) / 2;
  const row = rz;

  const coord = { x: col, y: row };
  if (!inBounds(coord)) return null;
  return coord;
}

/** Manhattan 別名（戰鬥邏輯沿用，實際回傳 hex 距離） */
export function manhattan(a: Coord, b: Coord): number {
  return hexDistance(a, b);
}

export function hexDistance(a: Coord, b: Coord): number {
  const ac = offsetToCube(a);
  const bc = offsetToCube(b);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

function offsetToCube(c: Coord): { x: number; y: number; z: number } {
  const x = c.x - (c.y - (c.y & 1)) / 2;
  const z = c.y;
  const y = -x - z;
  return { x, y, z };
}

export function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(coord: Coord): boolean {
  return coord.x >= 0 && coord.x < _gridWidth && coord.y >= 0 && coord.y < _gridHeight;
}

/** 六角格鄰居（pointy-top, odd-r） — 6 個方向 */
function hexNeighbors(coord: Coord): Coord[] {
  const isOdd = (coord.y & 1) === 1;
  const dirs: ReadonlyArray<readonly [number, number]> = isOdd
    ? [
        [+1, 0],
        [-1, 0],
        [+1, -1],
        [0, -1],
        [+1, +1],
        [0, +1],
      ]
    : [
        [+1, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
        [0, +1],
        [-1, +1],
      ];
  return dirs.map(([dx, dy]) => ({ x: coord.x + dx, y: coord.y + dy }));
}

/** Dijkstra：在六角格上計算可達範圍（含地形成本） */
export function bfsReachable(
  start: Coord,
  range: number,
  blocked: Set<string>
): Coord[] {
  const dist = new Map<string, number>();
  dist.set(coordKey(start), 0);
  const queue: { coord: Coord; cost: number }[] = [{ coord: start, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const item = queue.shift()!;
    const curKey = coordKey(item.coord);
    if ((dist.get(curKey) ?? Infinity) < item.cost) continue;

    for (const next of hexNeighbors(item.coord)) {
      const nKey = coordKey(next);
      if (!inBounds(next) || blocked.has(nKey)) continue;
      const tDef = TERRAIN_TYPES[getTerrainAt(next)];
      if (tDef.blocked) continue;
      const newCost = item.cost + tDef.moveCost;
      if (newCost > range) continue;
      if (newCost < (dist.get(nKey) ?? Infinity)) {
        dist.set(nKey, newCost);
        queue.push({ coord: next, cost: newCost });
      }
    }
  }

  const result: Coord[] = [];
  for (const [key] of dist) {
    if (key === coordKey(start)) continue;
    const [xs, ys] = key.split(',');
    result.push({ x: Number(xs), y: Number(ys) });
  }
  return result;
}

/** 攻擊範圍：所有 hex 距離 <= range 的格子（不含起點） */
export function attackTargetTiles(from: Coord, range: number): Coord[] {
  const tiles: Coord[] = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const c: Coord = { x: from.x + dx, y: from.y + dy };
      if (!inBounds(c)) continue;
      if (coordEq(c, from)) continue;
      if (hexDistance(c, from) > range) continue;
      tiles.push(c);
    }
  }
  return tiles;
}

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}
