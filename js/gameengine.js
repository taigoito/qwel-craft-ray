/*
 * Game Engine
 */

import { Model, Collection } from './framework.js';

class Actor extends Model {
  initialize() {
    const defaults = {
      name: 'my actor',
      x: 0, // 衝突判定の範囲
      y: 0,
      width: 24,
      height: 24
    }
    this.attributes = Object.assign(defaults, this.attributes);
  }

  hitTest(x, y) {
    const horizontal = this.get('x') - this.get('width') / 2 < x && x < this.get('x') + this.get('width') / 2;
    const vertical = this.get('y') - this.get('height') / 2 < y && y < this.get('y') + this.get('height') / 2;
    return (horizontal && vertical);
  }

  update(gameInfo, input) {
    // 継承先でオーバーライドする
  }

  render(gameInfo, input) {
    // 継承先でオーバーライドする
  }
}

class Scene extends Model {
  initialize() {
    const defaults = {
      name: 'my scene',
      timestamp: 0,
      startTime: 0,
      actors: new Collection()
    }
    this.attributes = Object.assign(defaults, this.attributes);
    this.on('start', this.start.bind(this));
    this.on('end', this.end.bind(this));
  }

  start(gameInfo) {
    console.log(`${this.get('name')} start`);
    this.set('timestamp', 0);
    this.set('startTime', gameInfo.timestamp);
  }

  end(gameInfo) {
    console.log(`${this.get('name')} end`);
    this.set('endTime', gameInfo.timestamp);
  }

  update(gameInfo, input) {
    this.set('timestamp', gameInfo.timestamp - this.get('startTime'));
    this._updateAll(gameInfo, input);
    this._renderAll(gameInfo);
  }

  _updateAll(gameInfo, input) {
    const actors = this.get('actors');
    actors.models.forEach((actor) => actor.update(gameInfo, input));
  }

  _renderAll(gameInfo) {
    this._clearScreen(gameInfo);
    const actors = this.get('actors');
    actors.models.forEach((actor) => actor.render(gameInfo.target));
  }

  _clearScreen(gameInfo) {
    const ctx = gameInfo.target.getContext('2d');
    ctx.fillStyle = gameInfo.background;
    ctx.fillRect(0, 0, gameInfo.width, gameInfo.height);
  }
}

class Game {
  constructor(target, width, height, background, maxFps, rootScene) {
    this.target = target;
    this.width = width;
    this.height = height;
    this.background = background;
    this.currentFps = 0;
    this.maxFps = maxFps;
    this.currentScene = rootScene;
    this.timestamp = 0;
    this.inputReceiver = new InputReceiver();
    this.start();
  }

  start() {
    this.currentScene.trigger('start', this);
    requestAnimationFrame(this._loop.bind(this));
  }

  _loop(timestamp) {
    const debugTime = 0;
    if (!debugTime || timestamp < debugTime) {
      //const start = performance.now();
      const elapsedSec = (timestamp - this.timestamp) / 1000;
      const accuracy = 0.9;
      const frameTime = 1 / this.maxFps * accuracy;
      if (elapsedSec <= frameTime) {
        requestAnimationFrame(this._loop.bind(this));
        return;
      }
      this.currentFps = 1 / elapsedSec;
      this.timestamp = timestamp;
      const gameInfo = {
        target: this.target,
        width: this.width,
        height: this.height,
        background: this.background,
        timestamp: this.timestamp
      };
      const input = this.inputReceiver.getInput();
      this.currentScene.update(gameInfo, input);
      //const end = performance.now();
      //const timeStr = (end - start).toPrecision(4);
      //console.log(timeStr);
      requestAnimationFrame(this._loop.bind(this));
    } else {
      console.log(this);
    }
  }

  change(scene) {
    this.currentScene.trigger('end', this);
    this.currentScene = scene;
    this.currentScene.trigger('start', this);
  }
}

class InputReceiver {
  constructor() {
    this._keyMap = new Map();
    this._prevKeyMap = new Map();
    addEventListener('keydown', (ke) => this._keyMap.set(ke.key, true));
    addEventListener('keyup', (ke) => this._keyMap.set(ke.key, false));
  }

  getInput() {
    const keyMap = new Map(this._keyMap);
    const prevKeyMap = new Map(this._prevKeyMap);
    this._prevKeyMap = new Map(this._keyMap);
    return new Input(keyMap, prevKeyMap);
  }
}

class Input {
  constructor(keyMap, prevKeyMap) {
    this.keyMap = keyMap;
    this.prevKeyMap = prevKeyMap;
  }

  getKeyDown(keyName) {
    const prevDown = this._getPrevKey(keyName);
    const currentDown = this.getKey(keyName);
    return (!prevDown && currentDown);
  }

  getKeyUp(keyName) {
    const prevDown = this._getPrevKey(keyName);
    const currentDown = this.getKey(keyName);
    return (prevDown && !currentDown);
  }

  getKey(keyName) {
    return this._getKeyFromMap(keyName, this.keyMap);
  }

  _getPrevKey(keyName) {
    return this._getKeyFromMap(keyName, this.prevKeyMap);
  }

  _getKeyFromMap(keyName, map) {
    if (map.has(keyName)) {
      return map.get(keyName);
    } else {
      return false;
    }
  }
}

export { Model, Collection, Actor, Scene, Game };
