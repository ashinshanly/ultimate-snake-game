// Grid-based spatial partitioning for efficient collision detection
class SpatialGrid {
  constructor(cellSize = 200) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    // Use a flat array pool instead of Map<string, Array> to avoid GC pressure
    this.cells = new Map();
    this._pool = [];
    this._poolIndex = 0;
  }

  clear() {
    // Recycle arrays instead of recreating them
    for (const arr of this.cells.values()) {
      arr.length = 0;
      if (this._pool.length < 512) {
        this._pool.push(arr);
      }
    }
    this.cells.clear();
  }

  _getArray() {
    if (this._pool.length > 0) {
      return this._pool.pop();
    }
    return [];
  }

  // Use integer key hashing instead of string concatenation
  _key(cx, cy) {
    // Cantor pairing with offset to handle negatives
    const a = cx + 16384;
    const b = cy + 16384;
    return a * 32768 + b;
  }

  insertSegment(segment) {
    const cx = (segment.x * this.invCellSize) | 0;
    const cy = (segment.y * this.invCellSize) | 0;
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = this._getArray();
      this.cells.set(key, cell);
    }
    cell.push(segment);
  }

  insert(entity) {
    const cx = (entity.x * this.invCellSize) | 0;
    const cy = (entity.y * this.invCellSize) | 0;
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = this._getArray();
      this.cells.set(key, cell);
    }
    cell.push(entity);
  }

  query(x, y, radius) {
    const results = [];
    const minCX = ((x - radius) * this.invCellSize) | 0;
    const maxCX = ((x + radius) * this.invCellSize) | 0;
    const minCY = ((y - radius) * this.invCellSize) | 0;
    const maxCY = ((y + radius) * this.invCellSize) | 0;

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }

  queryRect(x, y, hw, hh) {
    const results = [];
    const minCX = ((x - hw) * this.invCellSize) | 0;
    const maxCX = ((x + hw) * this.invCellSize) | 0;
    const minCY = ((y - hh) * this.invCellSize) | 0;
    const maxCY = ((y + hh) * this.invCellSize) | 0;

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}

module.exports = SpatialGrid;
