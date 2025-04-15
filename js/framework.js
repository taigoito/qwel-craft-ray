/*
 * Framework
 */

let idCouner = 0;

class Events {
  constructor() {
    this._events = {};
  }

  on(type, callback) {
    if (!this._events[type]) {
      this._events[type] = [];
    }
    this._events[type].push(callback);
    return this;
  }

  off(type, callback) {
    const listeners = this._events[type];
    if (listeners) {
      this._events[type] = listeners.filter((listener) => listener !== callback);
    }
    return this;
  }

  trigger(type, event) {
    const listeners = this._events[type];
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
    return this;
  }
}

class Model extends Events {
  constructor(attrs = {}) {
    super();

    // 識別子
    this.cid = idCouner++;

    // 属性
    this.attributes = attrs;

    // バリデーション
    if (!this._validate(this.attributes)) return false;

    // 初期化
    this.initialize()
  }

  _validate(attrs) {
    const error = this.validate(attrs) || false;
    if (error) {
      this.validationError = error;
      return false;
    } else {
      return true;
    }
  }

  initialize() {
    // 継承先でオーバーライドする
  }

  validate() {
    // 継承先でオーバーライドする
  }

  set(attr, value) {
    this.attributes[attr] = value;

    // バリデーション
    if (!this._validate(this.attributes)) return false;

    // `change`イベント発火
    this.trigger(`change:${attr}`, this);
    if (this.collection) {
      this.trigger.call(this.collection, `change:${attr}`, this);
    }

    // モデル自身を返す
    return this;
  }

  unset(attr) {
    delete this.attributes[attr];

    // `change`イベント発火
    this.trigger(`change:${attr}`, this);
    if (this.collection) {
      this.trigger.call(this.collection, `change:${attr}`, this);
    }

    // モデル自身を返す
    return this;
  }

  get(attr) {
    return this.attributes[attr];
  }

  set id(value) {
    this.set('id', value);
  }

  get id() {
    return this.get('id');
  }
}

class Collection extends Events {
  constructor(models = []) {
    super();

    // モデル
    this.models = [];
    this.length = 0;
    this.add(models);

    // 初期化
    this.initialize();
  }

  initialize() {
    // 継承先でオーバーライドする
  }

  at(id) {
    return this.models.find((elem) => elem.id === id);
  }

  // オプション
  // add: 既にモデルが存在する場合に、無視するか追加するか （初期値: false/追加する）
  // merge: 上記の場合に、上書きするかマージするか（初期値: false/マージする）
  // remove: リセット (初期値: false/リセットしない)
  // sort: ソート (初期値: false/ソートする)
  // `change`イベント発火はマージする場合に限る
  add(models, options = {}) {
    models = Array.isArray(models) ? models.slice() : [models];

    const add = options.add || false;
    const merge = options.merge || false;
    const remove = options.remove || false;
    const sort = options.sort || false;

    // remove:trueの場合はリセット
    if (remove) {
      // 引数のモデルを順次、コレクションと照合し、一致しなかったら削除
      this.models.forEach((model) => {
        const isRemoving = !models.some((elem) => elem.id === model.id);
        if (isRemoving) {
          this._removeModel(model);
        }
      });
      // `reset`イベント発火
      this.trigger('reset');
    }

    const len = models.length;
    for (let i = 0; i < len; i++) {
      const model = models[i];

      // モデルにIDが割り当てられている場合
      if (model.id || model.id === 0 || model.attributes.id || model.attributes.id === 0) {
        if (!model.id) model.id = model.attributes.id;
        const existing = this.models.find((elem) => elem.id === model.id);

        // 既にモデルが存在するとき、add:false/merge:falseの場合はマージ
        if (!add && !merge && existing) {
          this._mergeModel(existing, model);
        }

        // 既にモデルが存在するとき、add:false/merge:trueの場合は上書き
        if (!add && merge && existing) {
          this._overrideModel(existing, model);
        }

        // 既にモデルが存在するとき、add:trueの場合は無視
        // モデルが存在しないときはオプションに関わらず追加
        if (!existing) {
          this._addModel(model);
        }

        // モデルにIDが割り当てられていない場合は、IDを設定して追加
      } else {
        model.id = this.length ? this.models[this.length - 1].id + 1 : 0;
        model.set('id', model.id);
        this._addModel(model);
      }
    }

    // ソート
    if (sort) this.models.sort((a, b) => a.id - b.id);

    // コレクションを返す
    return this.models;
  }

  remove(arr) {
    arr = Array.isArray(arr) ? arr.slice() : [arr];

    // 引数の配列を順次、コレクションと照合し、一致したら削除
    const len = arr.length;
    for (let i = 0; i < len; i++) {

      // 要素がモデルを示す場合
      if (typeof arr[i] === 'object') {
        const model = arr[i];
        const isRemoving = this.models.some((elem) => elem.id === model.id);
        if (isRemoving) {
          this._removeModel(model);
        }

        // 要素がidを示す場合
      } else {
        const id = arr[i];
        const isRemoving = this.models.some((elem) => elem.id === id);
        if (isRemoving) {
          this._removeModel(this.at(id));
        }
      }
    }

    // コレクションを返す
    return this.models;
  }

  reset() {
    this.add([], { remove: true });
  }

  _addModel(model) {
    // モデルとコレクションの紐づけ
    model.collection = this;
    // モデル追加
    this.models.push(model);
    // lengthをリセット
    this.length = this.models.length;
    // `add`イベント発火
    this.trigger('add', model);
    // 追加したモデルを返す
    return model;
  }

  _mergeModel(model, newModel) {
    // モデルマージ（`change`イベント発火）
    for (let prop in newModel.attributes) {
      model.set(prop, newModel.attributes[prop]);
    }
    // マージしたモデルを返す
    return model;
  }

  _overrideModel(model, newModel) {
    // モデル上書き
    delete model.attributes;
    model.attributes = newModel.attributes;
    // 上書きしたモデルを返す
    return model;
  }

  _removeModel(model) {
    // モデルとコレクションの紐づけ解除
    delete model.collection;
    // モデル削除
    this.models = this.models.filter((elem) => elem.id !== model.id);
    // lengthをリセット
    this.length = this.models.length;
    // `remove`イベント発火
    this.trigger('remove', model);
    // 削除したモデルを返す
    return model;
  }
}

export { Model, Collection };
