/*
 * Ray
 */

import { Model, Collection, Actor, Scene, Game } from './gameengine.js';

let idCounter = 0;

// 光線オブジェクト
// 分光器（円形オブジェクト）で分解されたり、集光器（三角オブジェクト）で合成されたりする
class Ray extends Model{
  initialize() {
    const defaults = {
      id: idCounter++,
      distance: 0,    // 光源から開始位置までの距離（時間）
      range: 0,       // 開始位置から終了位置までの距離（progressによって変化）
      activate: true, // rangeが変化の最中
      lightR: 16,
      lightG: 16,
      lightB: 16,
      startX: 0,
      startY:0,
      angle: 0        // 30度,45度を表現できるように15度刻みで
    }
    this.attributes = Object.assign(defaults, this.attributes);
    
    // 光線の色
    if (this.get('lightR') > 12 && this.get('lightG') > 12 && this.get('lightB') > 12) {
      this.set('rgb', '#c0c0c0');
    } else {
      this.set('rgb', `rgb(${this.get('lightR') * 16 - 1},${this.get('lightG') * 16 - 1},${this.get('lightB') * 16 - 1})`);
    }
  }

  update(progress) {
    if (this.get('activate') && this.get('distance') < progress) {
      const range = progress - this.get('distance');
      this.set('range', range);
    }
  }

  // マスオブジェクトに衝突したとき
  end(endX, endY) {
    this.set('endX', endX);
    this.set('endY', endY);
    const w = endX - this.get('startX');
    const h = endY - this.get('startY');
    this.set('range', Math.sqrt(w * w + h * h));
    this.set('activate', false);
  }

  render(target) {
    if (this.get('range') > 8) {
      const ctx = target.getContext('2d');
      ctx.save();
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.get('rgb');
      ctx.translate(this.get('startX'), this.get('startY'));
      ctx.rotate(this.get('angle') * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, this.get('range') - 4);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, this.get('range') - 4);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// 光線オブジェクトが衝突すると、光線を反射（いずれは透過・吸収も）する
class Mass extends Actor {
  initialize() {
    const defaults = {
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      activateR: true,
      activateG: true,
      activateB: true,
      angle: 0,
      selectable: false,
      selected: false,
      entered: new Collection(),
      leave: new Collection()
    }
    this.attributes = Object.assign(defaults, this.attributes);
    const angle = this.get('angle');
    this.set('currentAngle', angle);
  }

  hitTest(ray, x, y) {
    return ray.get('range') > 4 && super.hitTest(x, y);
  }

  hitTestWithColor(ray) {
    return (ray.get('range') > 4 &&
      this.get('activateR') && ray.get('lightR') > 1 || 
      this.get('activateG') && ray.get('lightG') > 1 || 
      this.get('activateB') && ray.get('lightB') > 1);
  }

  enterRay(ray) {
    const entered = this.get('entered');
    let result = false;
    if (ray.get('lightR') > 1) {
      this.set('activateR', false);
      result |= true;
    }
    if (ray.get('lightG') > 1) {
      this.set('activateG', false);
      result |= true;
    }
    if (ray.get('lightB') > 1) {
      this.set('activateB', false);
      result |= true;
    }
    if (result) entered.add(ray);
    return result; // 光線が入った（反射に続く）という結果を返す
  }

  leaveRay(progress, callback) {
    // 継承先でオーバーライドする
  }

  update() {
    let currentAngle = this.get('currentAngle');
    const angle = currentAngle - this.get('angle');
    if ((0 < angle && angle < 180) || -360 < angle && angle < -180) {
      currentAngle--;
    } else if ((-180 < angle && angle < 0) || (180 < angle && angle < 360)) {
      currentAngle++;
    }
    currentAngle = (currentAngle + 360) % 360;
    this.set('currentAngle', currentAngle);
  }

  // アクティベートをON、コレクションを空に
  reset() {
    this.set('activateR', true);
    this.set('activateG', true);
    this.set('activateB', true);
    const entered = this.get('entered');
    entered.add([], {remove: true});
    const leave = this.get('leave');
    leave.add([], {remove: true});
  }

  render(target) {
    
  }

  _setContext (ctx) {
    ctx.translate(this.get('x'), this.get('y'));
    ctx.rotate((this.get('currentAngle') % 360) * Math.PI / 180);
    let rgba1, rgba2;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
    if (this.get('selected')) {
      rgba1 = '#c060c0';
    } else if (this.get('selectable')) {
      rgba1 = '#6060c0';
    } else {
      rgba1 = '#0060c0';
    }
    gradient.addColorStop(0.75, rgba1);
    if (this.get('selected') || this.get('activateR') && this.get('activateG') && this.get('activateB')) {
      rgba2 = rgba1;
    } else {
      rgba2 = `rgb(${this.get('activateR') ? 0 : 255},${this.get('activateG') ? 0 : 255},${this.get('activateB') ? 0 : 255})`;
    }
    gradient.addColorStop(0.0, rgba2);
    ctx.fillStyle = gradient;
  }
}

// 入射角に合わせて光の性質（色）を変えることなく反射する
class Line extends Mass {
  leaveRay(progress, callback) {
    const entered = this.get('entered');
    const len = entered.models.length;
    const ray = entered.models[len - 1];
    const reflected = new Ray({
      distance: progress,
      range: 0,
      activate: true,
      lightR: ray.get('lightR'),
      lightG: ray.get('lightG'),
      lightB: ray.get('lightB'),
      startX: ray.get('endX'),
      startY: ray.get('endY'),
      angle: (this.get('currentAngle') * 2 - ray.get('angle') + 180) % 360
    });
    const leave = this.get('leave');
    leave.add(reflected);
    callback(reflected);
  }

  update() {
    super.update();
    const entered = this.get('entered');
    const leave = this.get('leave');
    leave.models.forEach((ray, i) => {
      const prevRay = entered.models[i];
      const angle = (this.get('currentAngle') * 2 - prevRay.get('angle') + 180) % 360;
      ray.set('angle', angle);
    });
  }

  render(target) {
    const width = 48;
    const height = 8;
    const ctx = target.getContext('2d');
    ctx.save();
    this._setContext(ctx);
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }
}

// 光線を取り込み、左右の直角方向・垂直方向へと、分解した光線を射る
class Circle extends Mass {
  leaveRay(progress, callback) {
    const entered = this.get('entered');
    const ray = entered.models[0];
    const rayR = new Ray({
      distance: progress,
      range: 0,
      activate: true,
      lightR: ray.get('lightR'),
      lightG: 1,
      lightB: 1,
      startX: ray.get('endX'),
      startY: ray.get('endY'),
      angle: (ray.get('angle') + 270) % 360
    });
    const rayG = new Ray({
      distance: progress,
      range: 0,
      activate: true,
      lightR: 1,
      lightG: ray.get('lightG'),
      lightB: 1,
      startX: ray.get('endX'),
      startY: ray.get('endY'),
      angle: ray.get('angle')
    });
    const rayB = new Ray({
      distance: progress,
      range: 0,
      activate: true,
      lightR: 1,
      lightG: 1,
      lightB: ray.get('lightB'),
      startX: ray.get('endX'),
      startY: ray.get('endY'),
      angle: (ray.get('angle') + 90) % 360
    });
    const leave = this.get('leave');
    leave.add([rayR, rayG, rayB]);
    callback([rayR, rayG, rayB]);
  }

  render(target) {
    const radius = 24;
    const ctx = target.getContext('2d');
    ctx.save();
    this._setContext(ctx);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// 2辺から光線を取り込み、2辺の頂点から合成した光線を射る（正三角形）
class Triangle extends Mass {
  enterRay(ray) {
    const angle = this.get('currentAngle');
    const rayAngle = ray.get('angle');
    const leftAngle = (rayAngle + 300) % 360;
    const rightAngle = (rayAngle + 60) % 360;
    if (leftAngle <= angle && leftAngle >= rayAngle || rightAngle >= angle && rightAngle <= rayAngle || 
      leftAngle >= angle && leftAngle <= rayAngle || rightAngle <= angle && rightAngle >= rayAngle) {
      return super.enterRay(ray);
    } else {
      return false;
    }
  }

  leaveRay(progress, callback) {
    const entered = this.get('entered');
    let lightR = 1;
    let lightG = 1;
    let lightB = 1;
    entered.models.forEach((enteredRay) => {
      lightR = Math.max(lightR, enteredRay.get('lightR'));
      lightG = Math.max(lightG, enteredRay.get('lightG'));
      lightB = Math.max(lightB, enteredRay.get('lightB'));
    });
    const len = entered.models.length;
    const ray = entered.models[0];
    const reflected = new Ray({
      distance: progress,
      range: 0,
      activate: true,
      lightR: lightR,
      lightG: lightG,
      lightB: lightB,
      startX: ray.get('endX'),
      startY: ray.get('endY'),
      angle: this.get('currentAngle')
    });
    const leave = this.get('leave');
    leave.add(reflected);
    callback(reflected);
  }

  render(target) {
    const radius = 24;
    const ctx = target.getContext('2d');
    ctx.save();
    this._setContext(ctx);
    ctx.beginPath();
    ctx.moveTo(0, radius);
    ctx.lineTo(-radius, -radius / Math.SQRT2);
    ctx.lineTo(radius, -radius / Math.SQRT2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class Wall extends Mass {
  initialize() {
    super.initialize();
    this.set('width', 48);
    this.set('height', 48);
  }

  render(target) {
    const width = this.get('width');
    const height = this.get('height');
    const ctx = target.getContext('2d');
    ctx.save();
    this._setContext(ctx);
    ctx.fillRect(- width / 2, - height / 2, width, height);
    ctx.restore();
  }
}

class Stage extends Scene {
  initialize() {
    super.initialize();
    // 光線のコレクションを準備
    this.set('rays', new Collection());
  }

  start(gameInfo) {
    // マスオブジェクトを配置
    const actors = this.get('actors');
    actors.add([], {remove: true});
    this._layout();
    // ゴールを監視
    this.set('goal', false);
    this.on('change:goal', (stage) => {
      const goal = stage.get('goal');
      if (goal) {
        setTimeout(() => this.trigger('goal', this), 1000);
      }
    });
    super.start(gameInfo);
  }

  _layout() {
    // マップから、マスオブジェクトを配置
    const ray = this.get('souceRay');
    const map = this.get('map');
    const w = map[0].length
    const h = map.length;
    const actors = this.get('actors');
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = (i * 3 - j) * 15 + 52.5;
        const y = ((j * 5 - i) * 15 - 105) / Math.sqrt(3);
        const obj = map[j][i];
        const type = Math.floor(obj / 4);
        const angle = ray.get('angle') + (obj % 4) * 90;
        if (obj == 1) {
          actors.add(new Wall({
            x: x,
            y: y,
            angle: angle,
            selectable: false
          }));
        } else if (obj == 2) { // 開始位置をログ
          //console.log(x);
          //console.log(y / Math.sqrt(3));
        } else if (obj == 3) {
          const goal = new Mass({
            x: x,
            y: y,
            selectable: false
          });
          actors.add(goal);
          this._goal(goal);
        } else if (type == 1 || type == 2) {
          actors.add(new Line({
            x: x,
            y: y,
            angle: (angle + 45) % 360,
            selectable: type % 2
          }));
        } else if (type == 3 || type == 4) {
          actors.add(new Triangle({
            x: x,
            y: y,
            angle: angle % 360,
            selectable: type % 2
          }));
        } else if (type == 5) {
          actors.add(new Circle({
            x: x,
            y: y,
            selectable: false
          }));
        }
      }
    }
    // 選択可能アクターの抽出
    const selectedOrder = 0;
    this.set('selectedOrder', selectedOrder);
    this.selectableActors = actors.models.filter((actor) => actor.get('selectable'));
    // デフォルトアクターを選択
    const selectedActor = this.selectableActors[selectedOrder];
    selectedActor.set('selected', true);
     // 選択アクターの切り替えを監視
     this.on('change:selectedOrder', () => {
      const selectedOrder = this.get('selectedOrder');
      this.selectableActors.forEach((actor) => actor.set('selected', false));
      this.selectableActors[selectedOrder].set('selected', true);
    });
  }

  _goal(goal) {
    const entered = goal.get('entered');
    entered.on('add', (ray) => {
      if (!this.get('goal') && ray.get('lightR') == 16 && ray.get('lightG') == 16 && ray.get('lightB') == 16) {
        this.set('goal', true);
      }
    })
  }

  _shine() {
    // 全てのアクターをリセット
    const actors = this.get('actors');
    actors.models.forEach((actor) => {
      actor.reset();
    });
    // 入射
    const souceRay = this.get('souceRay');
    souceRay.set('activate', true);
    this._addRay(souceRay, {remove: true});
    this._updateRays();
  }

  _addRay(ray, options = {}) {
    const rays = this.get('rays');
    rays.add(ray, options);
  }

  _updateRays() {
    for (let i = 0; i < 3000; i++) {
      const rays = this.get('rays');
      rays.models.forEach((ray) => {
        ray.update(i);
        if (ray.get('activate')) this._hitTest(ray, i);
      });
    }
  }

  update(gameInfo, input) {
    // 光線オブジェクトの更新・描画
    this._shine();
    // マスオブジェクトの更新・描画
    super.update(gameInfo, input);
    
    // マスオブジェクトの操作
    let selectedOrder = this.get('selectedOrder');
    const actor = this.selectableActors[selectedOrder];
    // 角度変更受付
    let angle = actor.get('angle');
    if (input.getKeyDown('ArrowUp')) {
      angle += 345;
      angle = angle % 360;
      actor.set('angle', angle);
    }
    if (input.getKeyDown('ArrowDown')) {
      angle += 15;
      angle = angle % 360;
      actor.set('angle', angle);
    }
    // 選択切り替え
    if (input.getKeyDown('ArrowLeft')) {
      selectedOrder++;
      selectedOrder = selectedOrder % this.selectableActors.length;
      this.set('selectedOrder', selectedOrder);
      this.trigger('change:selectedOrder');
    };
    if (input.getKeyDown('ArrowRight')) {
      selectedOrder--;
      selectedOrder = (selectedOrder + this.selectableActors.length) % this.selectableActors.length;
      this.set('selectedOrder', selectedOrder);
      this.trigger('change:selectedOrder');
    };
  }

  _hitTest(ray, progress) {
    const x = ray.get('startX') - ray.get('range') * Math.sin(ray.get('angle') * Math.PI / 180);
    const y = ray.get('startY') + ray.get('range') * Math.cos(ray.get('angle') * Math.PI / 180);
    const actors = this.get('actors');
    actors.models.forEach((actor) => {
      if (actor.hitTest(ray, x, y)) {
        ray.end(actor.get('x'), actor.get('y')); // オブジェクトの中心に補正
        if (actor.hitTestWithColor(ray)) {
          const result = actor.enterRay(ray);
          if (result) actor.leaveRay(progress, this._addRay.bind(this));
        }
      }
    });
  }

  _renderAll(gameInfo) {
    super._renderAll(gameInfo);
    this._renderRays(gameInfo);
  }

  _renderRays(gameInfo) {
    const rays = this.get('rays');
    rays.models.forEach((ray) => ray.render(gameInfo.target));
  }
}

export { Ray, Stage, Game };
