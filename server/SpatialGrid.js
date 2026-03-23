// Grid-based spatial partitioning for efficient collision detection
class SpatialGrid {
  constructor(cellSize = 200) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  _cellCoords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  clear() {
    this.cells.clear();
  }

  insert(entity) {
    const [cx, cy] = this._cellCoords(entity.x, entity.y);
    const key = this._key(cx, cy);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(entity);
  }

  insertSegment(segment) {
    const [cx, cy] = this._cellCoords(segment.x, segment.y);
    const key = this._key(cx, cy);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(segment);
  }

  query(x, y, radius) {
    const results = [];
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (cell) {
          for (const entity of cell) {
            results.push(entity);
          }
        }
      }
    }
    return results;
  }

  queryRect(x, y, hw, hh) {
    const results = [];
    const minCX = Math.floor((x - hw) / this.cellSize);
    const maxCX = Math.floor((x + hw) / this.cellSize);
    const minCY = Math.floor((y - hh) / this.cellSize);
    const maxCY = Math.floor((y + hh) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (cell) results.push(...cell);
      }
    }
    return results;
  }
}

module.exports = SpatialGrid;
