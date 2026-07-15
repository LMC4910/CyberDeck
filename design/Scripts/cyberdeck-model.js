/* CyberDeck — ProjectModel (Phase 30)
 * Extracted document model + registries. Truth lives here as plain data keyed by
 * stable ids; the DOM renders TO it (elements carry only data-id). This is the
 * serialization path the IDE was missing (C3) and pulls the binding store /
 * component + variable registries out of the god-class (H5).
 *
 * Registered on window.CDKModel — loaded via a plain <script src> in the helmet.
 */
(function (root) {
  'use strict';

  // Stable, collision-free id allocator. Prefer crypto UUIDs; fall back to a
  // time+counter+random scheme so two ids never coincide within a session.
  var _n = 0;
  function uid(prefix) {
    _n++;
    var core;
    try {
      if (root.crypto && root.crypto.randomUUID) core = root.crypto.randomUUID().slice(0, 8);
      else throw 0;
    } catch (e) {
      core = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    return (prefix || 'id') + '_' + core + _n.toString(36);
  }

  // ProjectModel — owns the id-keyed registries and knows how to (de)serialize.
  function ProjectModel() {
    this.binds = {};   // id -> { prop -> {mode,src,expr,val} }
    this.states = {};  // id -> { active, custom[], ov{} }
    this.events = {};  // id -> { evk -> flowId }
    this.locks = {};   // id -> true
  }

  ProjectModel.prototype.newId = function (prefix) { return uid(prefix || 'w'); };

  // Load one registry object from a legacy localStorage key.
  ProjectModel.prototype.restore = function (store, key) {
    try { var r = root.localStorage.getItem(key); if (r) this[store] = JSON.parse(r) || {}; }
    catch (e) {}
    return this[store];
  };
  ProjectModel.prototype.persist = function (store, key) {
    try { root.localStorage.setItem(key, JSON.stringify(this[store] || {})); } catch (e) {}
  };

  // Re-key every registry from an old identity string to a stable id. Used once
  // when migrating documents that were keyed by display-name/slug (pre-Phase 30).
  ProjectModel.prototype.rekey = function (map) {
    ['binds', 'states', 'events', 'locks'].forEach(function (s) {
      var src = this[s] || {}, out = {};
      Object.keys(src).forEach(function (k) { out[map[k] || k] = src[k]; });
      this[s] = out;
    }, this);
  };

  // Full project document — widgets (measured from the board) + the registries.
  ProjectModel.prototype.serialize = function (widgets, meta) {
    return {
      format: 'cyberdeck.project',
      version: 1,
      savedAt: new Date().toISOString(),
      meta: meta || {},
      widgets: widgets || [],
      registries: {
        bindings: this.binds,
        states: this.states,
        events: this.events,
        locks: Object.keys(this.locks)
      }
    };
  };

  ProjectModel.prototype.load = function (doc) {
    if (!doc || !doc.registries) return;
    var r = doc.registries;
    this.binds = r.bindings || {};
    this.states = r.states || {};
    this.events = r.events || {};
    this.locks = {};
    (r.locks || []).forEach(function (id) { this.locks[id] = true; }, this);
  };

  ProjectModel.prototype.stats = function (doc) {
    var d = doc || this.serialize([], {});
    var countBound = 0;
    Object.keys(this.binds).forEach(function (id) {
      var o = this.binds[id] || {};
      if (Object.keys(o).some(function (p) { return o[p] && o[p].mode && o[p].mode !== 'static'; })) countBound++;
    }, this);
    return {
      widgets: (d.widgets || []).length,
      bindings: countBound,
      states: Object.keys(this.states).length,
      events: Object.keys(this.events).length,
      locks: Object.keys(this.locks).length
    };
  };

  root.CDKModel = { uid: uid, ProjectModel: ProjectModel };
})(typeof window !== 'undefined' ? window : this);
