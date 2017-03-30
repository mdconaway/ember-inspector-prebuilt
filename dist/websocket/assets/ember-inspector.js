"use strict";



define('ember-inspector/adapters/basic', ['exports', 'ember', 'ember-inspector/config/environment'], function (exports, _ember, _emberInspectorConfigEnvironment) {
  var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

  var computed = _ember['default'].computed;
  var K = _ember['default'].K;
  exports['default'] = _ember['default'].Object.extend({
    /**
     * Called when the adapter is created (when
     * the inspector app boots).
     *
     * @method init
     */
    init: function init() {
      this._super.apply(this, arguments);
      this._checkVersion();
    },

    /**
     * Listens to `EmberInspectorDebugger` message about
     * Ember version mismatch. If a mismatch message is received
     * it means the current inspector app does not support the current
     * Ember version and needs to switch to an inspector version
     * that does.
     *
     * @method _checkVersion
     * @private
     */
    _checkVersion: function _checkVersion() {
      var _this = this;

      this.onMessageReceived(function (message) {
        var name = message.name;
        var version = message.version;

        if (name === 'version-mismatch') {
          var previousVersions = _emberInspectorConfigEnvironment['default'].previousEmberVersionsSupported;

          var _config$emberVersionsSupported = _slicedToArray(_emberInspectorConfigEnvironment['default'].emberVersionsSupported, 2);

          var fromVersion = _config$emberVersionsSupported[0];
          var tillVersion = _config$emberVersionsSupported[1];

          var neededVersion = undefined;

          if (compareVersion(version, fromVersion) === -1) {
            neededVersion = previousVersions[previousVersions.length - 1];
          } else if (tillVersion && compareVersion(version, tillVersion) !== -1) {
            neededVersion = tillVersion;
          } else {
            return;
          }
          _this.onVersionMismatch(neededVersion);
        }
      });
      this.sendMessage({ type: 'check-version', from: 'devtools' });
    },

    /**
     * Hook called when the Ember version is not
     * supported by the current inspector version.
     *
     * Each adapter should implement this hook
     * to switch to an older/new inspector version
     * that supports this Ember version.
     *
     * @method onVersionMismatch
     * @param {String} neededVersion (The version to go to)
     */
    onVersionMismatch: K,

    name: 'basic',

    /**
      Used to send messages to EmberDebug
       @param type {Object} the message to the send
    **/
    sendMessage: function sendMessage() {},

    /**
      Register functions to be called
      when a message from EmberDebug is received
    **/
    onMessageReceived: function onMessageReceived(callback) {
      this.get('_messageCallbacks').pushObject(callback);
    },

    _messageCallbacks: computed(function () {
      return [];
    }),

    _messageReceived: function _messageReceived(message) {
      this.get('_messageCallbacks').forEach(function (callback) {
        callback(message);
      });
    },

    // Called when the "Reload" is clicked by the user
    willReload: K,

    canOpenResource: false,
    openResource: function openResource() /* file, line */{}

  });

  /**
   * Compares two Ember versions.
   *
   * Returns:
   * `-1` if version < version
   * 0 if version1 == version2
   * 1 if version1 > version2
   *
   * @param {String} version1
   * @param {String} version2
   * @return {Boolean} result of the comparison
   */
  function compareVersion(version1, version2) {
    version1 = cleanupVersion(version1).split('.');
    version2 = cleanupVersion(version2).split('.');
    for (var i = 0; i < 3; i++) {
      var compared = compare(+version1[i], +version2[i]);
      if (compared !== 0) {
        return compared;
      }
    }
    return 0;
  }

  /* Remove -alpha, -beta, etc from versions */
  function cleanupVersion(version) {
    return version.replace(/-.*/g, '');
  }

  function compare(val, number) {
    if (val === number) {
      return 0;
    } else if (val < number) {
      return -1;
    } else if (val > number) {
      return 1;
    }
  }
});
/**
 * The adapter stores logic specific to each environment.
 * Extend this object with env specific code (such as chrome/firefox/test),
 * then set the application's `adapter` property to the name of this adapter.
 *
 * example:
 *
 * ```javascript
 * const EmberInspector = App.Create({
 *   adapter: 'chrome'
 * });
 * ```
 */
define('ember-inspector/adapters/bookmarklet', ['exports', 'ember-inspector/adapters/basic', 'ember'], function (exports, _emberInspectorAdaptersBasic, _ember) {
  var computed = _ember['default'].computed;
  exports['default'] = _emberInspectorAdaptersBasic['default'].extend({
    name: 'bookmarklet',

    /**
     * Called when the adapter is created.
     *
     * @method init
     */
    init: function init() {
      this._connect();
      return this._super.apply(this, arguments);
    },

    inspectedWindow: computed(function () {
      return window.opener || window.parent;
    }),

    inspectedWindowURL: computed(function () {
      return loadPageVar('inspectedWindowURL');
    }),

    sendMessage: function sendMessage(options) {
      options = options || {};
      this.get('inspectedWindow').postMessage(options, this.get('inspectedWindowURL'));
    },

    /**
     * Redirect to the correct inspector version.
     *
     * @method onVersionMismatch
     * @param {String} goToVersion
     */
    onVersionMismatch: function onVersionMismatch(goToVersion) {
      this.sendMessage({ name: 'version-mismatch', version: goToVersion });
      window.location.href = '../panes-' + goToVersion.replace(/\./g, '-') + '/index.html' + window.location.search;
    },

    _connect: function _connect() {
      var _this = this;

      window.addEventListener('message', function (e) {
        var message = e.data;
        if (e.origin !== _this.get('inspectedWindowURL')) {
          return;
        }
        // close inspector if inspected window is unloading
        if (message && message.unloading) {
          window.close();
        }
        if (message.from === 'inspectedWindow') {
          _this._messageReceived(message);
        }
      });
    }
  });

  function loadPageVar(sVar) {
    return decodeURI(window.location.search.replace(new RegExp('^(?:.*[&\\?]' + encodeURI(sVar).replace(/[\.\+\*]/g, "\\$&") + '(?:\\=([^&]*))?)?.*$', "i"), "$1"));
  }
});
define('ember-inspector/adapters/chrome', ['exports', 'ember-inspector/adapters/basic', 'ember', 'ember-inspector/config/environment'], function (exports, _emberInspectorAdaptersBasic, _ember, _emberInspectorConfigEnvironment) {
  var computed = _ember['default'].computed;

  var emberDebug = null;

  exports['default'] = _emberInspectorAdaptersBasic['default'].extend({
    /**
     * Called when the adapter is created.
     *
     * @method init
     */
    init: function init() {
      this._connect();
      this._handleReload();
      this._injectDebugger();
      return this._super.apply(this, arguments);
    },

    name: 'chrome',

    sendMessage: function sendMessage(options) {
      options = options || {};
      this.get('_chromePort').postMessage(options);
    },

    _chromePort: computed(function () {
      return chrome.extension.connect();
    }),

    _connect: function _connect() {
      var _this = this;

      var chromePort = this.get('_chromePort');
      chromePort.postMessage({ appId: chrome.devtools.inspectedWindow.tabId });

      chromePort.onMessage.addListener(function (message) {
        if (typeof message.type === 'string' && message.type === 'iframes') {
          sendIframes(message.urls);
        }
        _this._messageReceived(message);
      });
    },

    _handleReload: function _handleReload() {
      var self = this;
      chrome.devtools.network.onNavigated.addListener(function () {
        self._injectDebugger();
        location.reload(true);
      });
    },

    _injectDebugger: function _injectDebugger() {
      chrome.devtools.inspectedWindow.eval(loadEmberDebug());
      chrome.devtools.inspectedWindow.onResourceAdded.addListener(function (opts) {
        if (opts.type === 'document') {
          sendIframes([opts.url]);
        }
      });
    },

    willReload: function willReload() {
      this._injectDebugger();
    },

    /**
     * Open the devtools "Elements" tab and select a specific DOM element.
     *
     * @method inspectDOMElement
     * @param  {String} selector jQuery selector
     */
    inspectDOMElement: function inspectDOMElement(selector) {
      chrome.devtools.inspectedWindow.eval('inspect($(\'' + selector + '\')[0])');
    },

    /**
     * Redirect to the correct inspector version.
     *
     * @method onVersionMismatch
     * @param {String} goToVersion
     */
    onVersionMismatch: function onVersionMismatch(goToVersion) {
      window.location.href = '../panes-' + goToVersion.replace(/\./g, '-') + '/index.html';
    },

    /**
      We handle the reload here so we can inject
      scripts as soon as possible into the new page.
    */
    reloadTab: function reloadTab() {
      chrome.devtools.inspectedWindow.reload({
        injectedScript: loadEmberDebug()
      });
    },

    canOpenResource: true,

    openResource: function openResource(file, line) {
      /*global chrome */
      // For some reason it opens the line after the one specified
      chrome.devtools.panels.openResource(file, line - 1);
    }

  });

  function sendIframes(urls) {
    urls.forEach(function (url) {
      chrome.devtools.inspectedWindow.eval(loadEmberDebug(), { frameURL: url });
    });
  }

  function loadEmberDebug() {
    var minimumVersion = _emberInspectorConfigEnvironment['default'].emberVersionsSupported[0].replace(/\./g, '-');
    var xhr = undefined;
    if (!emberDebug) {
      xhr = new XMLHttpRequest();
      xhr.open("GET", chrome.extension.getURL('/panes-' + minimumVersion + '/ember_debug.js'), false);
      xhr.send();
      emberDebug = xhr.responseText;
    }
    return emberDebug;
  }
});
/* globals chrome */
define("ember-inspector/adapters/firefox", ["exports", "ember", "ember-inspector/adapters/basic"], function (exports, _ember, _emberInspectorAdaptersBasic) {
  exports["default"] = _emberInspectorAdaptersBasic["default"].extend({
    name: 'firefox',

    /**
     * Called when the adapter is created.
     *
     * @method init
     */
    init: function init() {
      this._connect();
      return this._super.apply(this, arguments);
    },

    sendMessage: function sendMessage(options) {
      options = options || {};
      window.parent.postMessage(options, "*");
    },

    /**
     * Redirects to the correct inspector version.
     * Also re-injects the correct EmberDebug version.
     *
     * @method onVersionMismatch
     * @param {String} goToVersion
     */
    onVersionMismatch: function onVersionMismatch(version) {
      this.sendMessage({ type: "injectEmberDebug", version: version });
      window.location.href = "../panes-" + version.replace(/\./g, '-') + "/index.html";
    },

    _connect: function _connect() {
      // NOTE: chrome adapter sends a appId message on connect (not needed on firefox)
      //this.sendMessage({ appId: "test" });
      this._onMessage = this._onMessage.bind(this);
      window.addEventListener("message", this._onMessage, false);
    },

    _onMessage: function _onMessage(evt) {
      if (this.isDestroyed || this.isDestroying) {
        window.removeEventListener("message", this._onMessage, false);
        return;
      }

      var message = evt.data;
      // check if the event is originated by our privileged ember inspector code
      if (evt.isTrusted) {
        if (typeof message.type === 'string' && message.type === 'iframes') {
          this._sendIframes(message.urls);
        } else {
          // We clone the object so that Ember prototype extensions
          // are applied.
          this._messageReceived(_ember["default"].$.extend(true, {}, message));
        }
      } else {
        console.log("EMBER INSPECTOR: ignored post message", evt);
      }
    },

    _sendIframes: function _sendIframes(urls) {
      var _this = this;

      urls.forEach(function (url) {
        _this.sendMessage({ type: 'injectEmberDebug', frameURL: url });
      });
    },

    canOpenResource: true,

    openResource: function openResource(file, line) {
      this.sendMessage({
        type: 'devtools:openSource',
        url: file,
        line: line
      });
    }

  });
});
define("ember-inspector/adapters/websocket", ["exports", "ember", "ember-inspector/adapters/basic"], function (exports, _ember, _emberInspectorAdaptersBasic) {
  var computed = _ember["default"].computed;
  exports["default"] = _emberInspectorAdaptersBasic["default"].extend({
    init: function init() {
      this._super();
      this._connect();
    },

    sendMessage: function sendMessage(options) {
      options = options || {};
      this.get('socket').emit('emberInspectorMessage', options);
    },

    socket: computed(function () {
      return window.EMBER_INSPECTOR_CONFIG.remoteDebugSocket;
    }),

    _connect: function _connect() {
      var _this = this;

      this.get('socket').on('emberInspectorMessage', function (message) {
        _ember["default"].run(function () {
          _this._messageReceived(message);
        });
      });
    },

    _disconnect: function _disconnect() {
      this.get('socket').removeAllListeners("emberInspectorMessage");
    },

    willDestroy: function willDestroy() {
      this._disconnect();
    }
  });
});
define('ember-inspector/app', ['exports', 'ember', 'ember-inspector/resolver', 'ember-load-initializers', 'ember-inspector/config/environment', 'ember-inspector/port', 'ember-inspector/libs/promise-assembler'], function (exports, _ember, _emberInspectorResolver, _emberLoadInitializers, _emberInspectorConfigEnvironment, _emberInspectorPort, _emberInspectorLibsPromiseAssembler) {

  _ember['default'].MODEL_FACTORY_INJECTIONS = true;

  var version = '2.0.5';

  var App = _ember['default'].Application.extend({
    modulePrefix: _emberInspectorConfigEnvironment['default'].modulePrefix,
    podModulePrefix: _emberInspectorConfigEnvironment['default'].podModulePrefix,
    Resolver: _emberInspectorResolver['default']
  });

  // TODO: remove this when fixed
  // problem description: registry classes being registered
  // again on app reset. this will clear the registry.
  // long term solution: make registry initializers run once on app
  // creation.
  // issue: https://github.com/emberjs/ember.js/issues/10310
  // pr: https://github.com/emberjs/ember.js/pull/10597
  App.reopen({
    buildInstance: function buildInstance() {
      this.buildRegistry();
      return this._super.apply(this, arguments);
    }
  });

  _emberInspectorConfigEnvironment['default'].VERSION = version;

  // Inject adapter
  App.initializer({
    name: "extension-init",

    initialize: function initialize(instance) {
      // websocket is replaced by the build process.
      instance.adapter = 'websocket';

      // register and inject adapter
      var Adapter = undefined;
      if (_ember['default'].typeOf(instance.adapter) === 'string') {
        Adapter = instance.resolveRegistration('adapter:' + instance.adapter);
      } else {
        Adapter = instance.adapter;
      }
      instance.register('adapter:main', Adapter);
      instance.inject('port', 'adapter', 'adapter:main');
      instance.inject('route:application', 'adapter', 'adapter:main');
      instance.inject('route:deprecations', 'adapter', 'adapter:main');
      instance.inject('controller:deprecations', 'adapter', 'adapter:main');

      // register config
      instance.register('config:main', _emberInspectorConfigEnvironment['default'], { instantiate: false });
      instance.inject('route', 'config', 'config:main');

      // inject port
      instance.register('port:main', instance.Port || _emberInspectorPort['default']);
      instance.inject('controller', 'port', 'port:main');
      instance.inject('route', 'port', 'port:main');
      instance.inject('component', 'port', 'port:main');
      instance.inject('promise-assembler', 'port', 'port:main');

      // register and inject promise assembler
      instance.register('promise-assembler:main', _emberInspectorLibsPromiseAssembler['default']);
      instance.inject('route:promiseTree', 'assembler', 'promise-assembler:main');
    }
  });

  (0, _emberLoadInitializers['default'])(App, _emberInspectorConfigEnvironment['default'].modulePrefix);

  exports['default'] = App;
});
define('ember-inspector/components/action-checkbox', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  exports['default'] = Component.extend({
    tagName: 'input',
    attributeBindings: ['type', 'checked'],
    type: 'checkbox',

    checked: false,

    change: function change() {
      this._updateElementValue();
    },

    _updateElementValue: function _updateElementValue() {
      this.set('checked', this.$().prop('checked'));
      this.sendAction('on-update', this.get('checked'));
    }
  });
});
define('ember-inspector/components/app-version', ['exports', 'ember-cli-app-version/components/app-version', 'ember-inspector/config/environment'], function (exports, _emberCliAppVersionComponentsAppVersion, _emberInspectorConfigEnvironment) {

  var name = _emberInspectorConfigEnvironment['default'].APP.name;
  var version = _emberInspectorConfigEnvironment['default'].APP.version;

  exports['default'] = _emberCliAppVersionComponentsAppVersion['default'].extend({
    version: version,
    name: name
  });
});
define('ember-inspector/components/async-image', ['exports', 'ember-async-image/components/async-image'], function (exports, _emberAsyncImageComponentsAsyncImage) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _emberAsyncImageComponentsAsyncImage['default'];
    }
  });
});
define('ember-inspector/components/clear-button', ['exports', 'ember-inspector/components/icon-button'], function (exports, _emberInspectorComponentsIconButton) {
  exports['default'] = _emberInspectorComponentsIconButton['default'].extend({
    title: 'Clear'
  });
});
define('ember-inspector/components/container-instance', ['exports', 'ember', 'ember-inspector/mixins/row-events'], function (exports, _ember, _emberInspectorMixinsRowEvents) {
  var Component = _ember['default'].Component;
  exports['default'] = Component.extend(_emberInspectorMixinsRowEvents['default'], {
    /**
     * No tag
     *
     * @property tagName
     * @type {String}
     */
    tagName: ''
  });
});
/**
 * This component is used to wrap every row in the container
 * instances template.
 *
 * The main purpose for this component is to use the `RowEvents`
 * mixin so we can send `on-click` events when a row is clicked.
 *
 * Since it has no tag it has no effect on the DOM hierarchy.
 */
define("ember-inspector/components/date-property-field", ["exports", "ember", "ember-inspector/components/pikaday-input"], function (exports, _ember, _emberInspectorComponentsPikadayInput) {
  var on = _ember["default"].on;
  var once = _ember["default"].run.once;

  var KEY_EVENTS = {
    escape: 27
  };

  exports["default"] = _emberInspectorComponentsPikadayInput["default"].extend({
    /**
     * Workaround bug of `onPikadayClose` being called
     * on a destroyed component.
     */
    onPikadayClose: function onPikadayClose() {
      if (!this.$()) {
        return;
      }
      return this._super.apply(this, arguments);
    },

    openDatePicker: on('didInsertElement', function () {
      once(this.$(), 'click');
    }),

    keyUp: function keyUp(e) {
      if (e.keyCode === KEY_EVENTS.escape) {
        this.sendAction('cancel');
      }
      return this._super.apply(this, arguments);
    }
  });
});
define('ember-inspector/components/deprecation-item-source', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var bool = computed.bool;
  var readOnly = computed.readOnly;
  var and = computed.and;
  exports['default'] = Component.extend({
    /**
     * No tag.
     *
     * @property tagName
     * @type {String}
     */
    tagName: '',

    known: bool('model.map.source'),

    url: computed('model.map.source', 'model.map.line', 'known', function () {
      var source = this.get('model.map.source');
      if (this.get('known')) {
        return source + ':' + this.get('model.map.line');
      } else {
        return 'Unkown source';
      }
    }),

    adapter: readOnly('port.adapter'),

    isClickable: and('known', 'adapter.canOpenResource')
  });
});
define('ember-inspector/components/deprecation-item', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var notEmpty = computed.notEmpty;
  exports['default'] = Component.extend({
    isExpanded: true,

    tagName: '',

    hasMap: notEmpty('model.hasSourceMap'),

    actions: {
      toggleExpand: function toggleExpand() {
        this.toggleProperty('isExpanded');
      }
    }
  });
});
define('ember-inspector/components/drag-handle', ['exports', 'ember'], function (exports, _ember) {
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  exports['default'] = _ember['default'].Component.extend({
    classNames: ['drag-handle'],
    classNameBindings: ['isLeft:drag-handle--left', 'isRight:drag-handle--right', 'faded:drag-handle--faded'],
    attributeBindings: ['style'],
    position: 0,
    side: '',
    isRight: _ember['default'].computed.equal('side', 'right'),
    isLeft: _ember['default'].computed.equal('side', 'left'),
    minWidth: 60,

    /**
     * The maximum width this handle can be dragged to.
     *
     * @property maxWidth
     * @type {Number}
     * @default Infinity
     */
    maxWidth: Infinity,

    /**
     * The left offset to add to the initial position.
     *
     * @property left
     * @type {Number}
     * @default 0
     */
    left: 0,

    /**
     * Modifier added to the class to fade the drag handle.
     *
     * @property faded
     * @type {Boolean}
     * @default false
     */
    faded: false,

    /**
     * Action to trigger whenever the drag handle is moved.
     * Pass this action through the template.
     *
     * @property on-drag
     * @type {Function}
     */
    'on-drag': function onDrag() {},

    startDragging: function startDragging() {
      var _this = this;

      var $container = this.$().parent();
      var $containerOffsetLeft = $container.offset().left;
      var $containerOffsetRight = $containerOffsetLeft + $container.width();
      var namespace = 'drag-' + this.get('elementId');

      this.sendAction('action', true);

      _ember['default'].$('body').on('mousemove.' + namespace, function (e) {
        var position = _this.get('isLeft') ? e.pageX - $containerOffsetLeft : $containerOffsetRight - e.pageX;

        position -= _this.get('left');
        if (position >= _this.get('minWidth') && position <= _this.get('maxWidth')) {
          _this.set('position', position);
          _this.get('on-drag')(position);
        }
      }).on('mouseup.' + namespace + ' mouseleave.' + namespace, function () {
        _this.stopDragging();
      });
    },

    stopDragging: function stopDragging() {
      this.sendAction('action', false);
      _ember['default'].$('body').off('.drag-' + this.get('elementId'));
    },

    willDestroyElement: function willDestroyElement() {
      this._super();
      this.stopDragging();
    },

    mouseDown: function mouseDown() {
      this.startDragging();
      return false;
    },

    style: computed('side', 'position', 'left', function () {
      var string = undefined;
      if (this.get('side')) {
        string = this.get('side') + ': ' + (this.get('position') + this.get('left')) + 'px;';
      } else {
        string = '';
      }
      return htmlSafe(string);
    })
  });
});
define('ember-inspector/components/draggable-column', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var inject = _ember['default'].inject;
  var service = inject.service;
  exports['default'] = Component.extend({
    tagName: '', // Prevent wrapping in a div
    side: 'left',
    minWidth: 60,
    setIsDragging: 'setIsDragging',

    /**
     * Injected `layout` service. Used to broadcast
     * changes the layout of the app.
     *
     * @property layout
     * @type {Service}
     */
    layout: service(),

    /**
     * Trigger that the application dimensions have changed due to
     * something being dragged/resized such as the main nav or the
     * object inspector.
     *
     * @method triggerResize
     */
    triggerResize: function triggerResize() {
      this.get('layout').trigger('resize', { source: 'draggable-column' });
    },

    actions: {
      setIsDragging: function setIsDragging(isDragging) {
        this.sendAction('setIsDragging', isDragging);
      },

      /**
       * Action called whenever the draggable column has been
       * resized.
       *
       * @method didDrag
       */
      didDrag: function didDrag() {
        this.triggerResize();
      }
    }
  });
});
// DraggableColumn
// ===============
// A wrapper for a resizable-column and a drag-handle component
define('ember-inspector/components/icon-button', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  exports['default'] = Component.extend({
    attributeBindings: ['title'],

    tagName: 'button',

    title: null,

    click: function click() {
      this.sendAction();
    }
  });
});
define('ember-inspector/components/iframe-picker', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var run = _ember['default'].run;
  var observer = _ember['default'].observer;
  var getOwner = _ember['default'].getOwner;
  var alias = computed.alias;
  exports['default'] = Component.extend({
    model: computed('port.detectedApplications.[]', function () {
      return this.get('port.detectedApplications').map(function (val) {
        var name = val.split('__')[1];
        return { name: name, val: val };
      });
    }),

    selectedApp: alias('port.applicationId'),

    selectedDidChange: observer('selectedApp', function () {
      // Change iframe being debugged
      var url = '/';
      var applicationId = this.get('selectedApp');
      var list = this.get('port').get('detectedApplications');
      var app = getOwner(this).lookup('application:main');

      run(app, app.reset);
      var router = app.__container__.lookup('router:main');
      var port = app.__container__.lookup('port:main');
      port.set('applicationId', applicationId);
      port.set('detectedApplications', list);

      // start
      app.boot().then(function () {
        router.location.setURL(url);
        run(app.__deprecatedInstance__, 'handleURL', url);
      });
    }),

    actions: {
      selectIframe: function selectIframe(applicationId) {
        this.set('selectedApp', applicationId);
      }
    }
  });
});
define('ember-inspector/components/in-viewport', ['exports', 'smoke-and-mirrors/components/in-viewport'], function (exports, _smokeAndMirrorsComponentsInViewport) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _smokeAndMirrorsComponentsInViewport['default'];
    }
  });
});
define('ember-inspector/components/main-content', ['exports', 'ember', 'ember-concurrency'], function (exports, _ember, _emberConcurrency) {
  var Component = _ember['default'].Component;
  var schedule = _ember['default'].run.schedule;
  var $ = _ember['default'].$;
  var service = _ember['default'].inject.service;

  // Currently used to determine the height of list-views
  exports['default'] = Component.extend({
    /**
     * Layout service. We inject it to keep its `contentHeight` property
     * up-to-date.
     *
     * @property layoutService
     * @type  {Service} layout
     */
    layoutService: service('layout'),

    didInsertElement: function didInsertElement() {
      var _this = this;

      $(window).on('resize.view-' + this.get('elementId'), function () {
        _this.get('updateHeightDebounce').perform();
      });
      schedule('afterRender', this, this.updateHeight);
      return this._super.apply(this, arguments);
    },

    /**
     * Restartable Ember Concurrency task that triggers
     * `updateHeight` after 100ms.
     *
     * @property updateHeightDebounce
     * @type {Object} Ember Concurrency task
     */
    updateHeightDebounce: (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$0$0() {
      return regeneratorRuntime.wrap(function callee$0$0$(context$1$0) {
        while (1) switch (context$1$0.prev = context$1$0.next) {
          case 0:
            context$1$0.next = 2;
            return (0, _emberConcurrency.timeout)(100);

          case 2:
            this.updateHeight();

          case 3:
          case 'end':
            return context$1$0.stop();
        }
      }, callee$0$0, this);
    })).restartable(),

    /**
     * Update the layout's `contentHeight` property.
     * This will cause the layout service to trigger
     * the `content-height-update` event which will update
     * list heights.
     *
     * This is called initially when this component is inserted
     * and whenever the window is resized.
     *
     * @method updateHeight
     */
    updateHeight: function updateHeight() {
      this.get('layoutService').updateContentHeight(this.$().height());
    },

    willDestroyElement: function willDestroyElement() {
      $(window).off('.view-' + this.get('elementId'));
      return this._super.apply(this, arguments);
    }
  });
});
define('ember-inspector/components/mixin-detail', ['exports', 'ember'], function (exports, _ember) {
  var computed = _ember['default'].computed;
  var Component = _ember['default'].Component;
  var readOnly = computed.readOnly;
  exports['default'] = Component.extend({
    /**
     * mixinDetails controller passed through the template
     *
     * @property mixinDetails
     * @type {Ember.Controller}
     */
    mixinDetails: null,

    objectId: readOnly('mixinDetails.model.objectId'),

    isExpanded: computed('model.expand', 'model.properties.length', function () {
      return this.get('model.expand') && this.get('model.properties.length') > 0;
    }),

    actions: {
      calculate: function calculate(_ref) {
        var name = _ref.name;

        var objectId = this.get('objectId');
        var mixinIndex = this.get('mixinDetails.model.mixins').indexOf(this.get('model'));

        this.get('port').send('objectInspector:calculate', {
          objectId: objectId,
          mixinIndex: mixinIndex,
          property: name
        });
      },

      sendToConsole: function sendToConsole(_ref2) {
        var name = _ref2.name;

        var objectId = this.get('objectId');

        this.get('port').send('objectInspector:sendToConsole', {
          objectId: objectId,
          property: name
        });
      },

      toggleExpanded: function toggleExpanded() {
        this.toggleProperty('isExpanded');
      },

      digDeeper: function digDeeper(_ref3) {
        var name = _ref3.name;

        var objectId = this.get('objectId');

        this.get('port').send('objectInspector:digDeeper', {
          objectId: objectId,
          property: name
        });
      },

      saveProperty: function saveProperty(property, value, dataType) {
        var mixinIndex = this.get('mixinDetails.model.mixins').indexOf(this.get('model'));

        this.get('port').send('objectInspector:saveProperty', {
          objectId: this.get('objectId'),
          property: property,
          value: value,
          mixinIndex: mixinIndex,
          dataType: dataType
        });
      }
    }
  });
});
define('ember-inspector/components/mixin-details', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  exports['default'] = Component.extend({
    actions: {
      traceErrors: function traceErrors() {
        this.get('port').send('objectInspector:traceErrors', {
          objectId: this.get('model.objectId')
        });
      }
    }
  });
});
define('ember-inspector/components/mixin-property', ['exports', 'ember'], function (exports, _ember) {
  var computed = _ember['default'].computed;
  var Component = _ember['default'].Component;
  var equal = computed.equal;
  var alias = computed.alias;
  exports['default'] = Component.extend({
    isEdit: false,

    /**
     * Passed through the template.
     *
     * The mixin-detail component
     * @type {Ember.Component}
     */
    mixin: null,

    // Bound to editing textbox
    txtValue: null,
    dateValue: null,

    isCalculated: computed('model.value.type', function () {
      return this.get('model.value.type') !== 'type-descriptor';
    }),

    isEmberObject: equal('model.value.type', 'type-ember-object'),

    isComputedProperty: alias('model.value.computed'),

    isFunction: equal('model.value.type', 'type-function'),

    isArray: equal('model.value.type', 'type-array'),

    isDate: equal('model.value.type', 'type-date'),

    _parseTextValue: function _parseTextValue(value) {
      var parsedValue = undefined;
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
        // if surrounded by quotes, remove quotes
        var match = value.match(/^"(.*)"$/);
        if (match && match.length > 1) {
          parsedValue = match[1];
        } else {
          parsedValue = value;
        }
      }
      return parsedValue;
    },

    actions: {
      valueClick: function valueClick() {
        if (this.get('isEmberObject') || this.get('isArray')) {
          this.get('mixin').send('digDeeper', this.get('model'));
          return;
        }

        if (this.get('isComputedProperty') && !this.get('isCalculated')) {
          this.get('mixin').send('calculate', this.get('model'));
          return;
        }

        if (this.get('isFunction') || this.get('model.overridden') || this.get('model.readOnly')) {
          return;
        }

        var value = this.get('model.value.inspect');
        var type = this.get('model.value.type');
        if (type === 'type-string') {
          value = '"' + value + '"';
        }
        if (!this.get('isDate')) {
          this.set('txtValue', value);
        } else {
          this.set('dateValue', new Date(value));
        }
        this.set('isEdit', true);
      },

      saveProperty: function saveProperty() {
        var realValue = undefined,
            dataType = undefined;
        if (!this.get('isDate')) {
          realValue = this._parseTextValue(this.get('txtValue'));
        } else {
          realValue = this.get('dateValue').getTime();
          dataType = 'date';
        }
        this.get('mixin').send('saveProperty', this.get('model.name'), realValue, dataType);
      },

      finishedEditing: function finishedEditing() {
        this.set('isEdit', false);
      },

      dateSelected: function dateSelected(val) {
        this.set('dateValue', val);
        this.send('saveProperty');
        this.send('finishedEditing');
      }
    }
  });
});
define('ember-inspector/components/object-inspector', ['exports', 'ember'], function (exports, _ember) {
  var _slice = Array.prototype.slice;
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;

  var get = _ember['default'].get;
  exports['default'] = Component.extend({
    tagName: '',

    /**
     * Application Controller passed
     * through the template
     *
     * @property application
     * @type {Controller}
     */
    application: null,

    trail: computed('model.[]', function () {
      var nested = this.get('model').slice(1);
      if (nested.length === 0) {
        return "";
      }
      return '.' + nested.mapBy('property').join(".");
    }),

    isNested: computed('model.[]', function () {
      return this.get('model.length') > 1;
    }),

    actions: {
      popStack: function popStack() {
        if (this.get('isNested')) {
          this.get('application').popMixinDetails();
        }
      },

      sendObjectToConsole: function sendObjectToConsole(obj) {
        var objectId = get(obj, 'objectId');
        this.get('port').send('objectInspector:sendToConsole', {
          objectId: objectId
        });
      },

      toggleInspector: function toggleInspector() {
        this.sendAction.apply(this, ['toggleInspector'].concat(_slice.call(arguments)));
      }
    }
  });
});
define('ember-inspector/components/occludable-area', ['exports', 'smoke-and-mirrors/components/occludable-area'], function (exports, _smokeAndMirrorsComponentsOccludableArea) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _smokeAndMirrorsComponentsOccludableArea['default'];
    }
  });
});
define('ember-inspector/components/pikaday-input', ['exports', 'ember', 'ember-pikaday/components/pikaday-input'], function (exports, _ember, _emberPikadayComponentsPikadayInput) {
  exports['default'] = _emberPikadayComponentsPikadayInput['default'];
});
define('ember-inspector/components/pre-render', ['exports', 'smoke-and-mirrors/components/pre-render'], function (exports, _smokeAndMirrorsComponentsPreRender) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _smokeAndMirrorsComponentsPreRender['default'];
    }
  });
});
define('ember-inspector/components/promise-item', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  var isEmpty = _ember['default'].isEmpty;
  var notEmpty = computed.notEmpty;
  var gt = computed.gt;
  var equal = computed.equal;

  var COLOR_MAP = {
    red: '#ff2717',
    blue: '#174fff',
    green: '#006400'
  };

  exports['default'] = Component.extend({
    tagName: '',

    filter: null,
    effectiveSearch: null,

    isError: equal('model.reason.type', 'type-error'),

    style: computed('model.state', function () {
      var color = '';
      if (this.get('model.isFulfilled')) {
        color = 'green';
      } else if (this.get('model.isRejected')) {
        color = 'red';
      } else {
        color = 'blue';
      }
      return htmlSafe('background-color: ' + COLOR_MAP[color] + '; color: white;');
    }),

    nodeStyle: computed('model.state', 'filter', 'effectiveSearch', function () {
      var relevant = undefined;
      switch (this.get('filter')) {
        case 'pending':
          relevant = this.get('model.isPending');
          break;
        case 'rejected':
          relevant = this.get('model.isRejected');
          break;
        case 'fulfilled':
          relevant = this.get('model.isFulfilled');
          break;
        default:
          relevant = true;
      }
      if (relevant && !isEmpty(this.get('effectiveSearch'))) {
        relevant = this.get('model').matchesExactly(this.get('effectiveSearch'));
      }
      if (!relevant) {
        return 'opacity: 0.3;';
      } else {
        return '';
      }
    }),

    labelStyle: computed('model.level', 'nodeStyle', function () {
      return htmlSafe('padding-left: ' + (+this.get('model.level') * 20 + 5) + 'px;' + this.get('nodeStyle'));
    }),

    expandedClass: computed('hasChildren', 'model.isExpanded', function () {
      if (!this.get('hasChildren')) {
        return;
      }

      if (this.get('model.isExpanded')) {
        return 'list__cell_arrow_expanded';
      } else {
        return 'list__cell_arrow_collapsed';
      }
    }),

    hasChildren: gt('model.children.length', 0),

    settledValue: computed('model.value', function () {
      if (this.get('model.isFulfilled')) {
        return this.get('model.value');
      } else if (this.get('model.isRejected')) {
        return this.get('model.reason');
      } else {
        return '--';
      }
    }),

    isValueInspectable: notEmpty('settledValue.objectId'),

    hasValue: computed('settledValue', 'model.isSettled', function () {
      return this.get('model.isSettled') && this.get('settledValue.type') !== 'type-undefined';
    }),

    label: computed('model.label', function () {
      return this.get('model.label') || !!this.get('model.parent') && 'Then' || '<Unknown Promise>';
    }),

    state: computed('model.state', function () {
      if (this.get('model.isFulfilled')) {
        return 'Fulfilled';
      } else if (this.get('model.isRejected')) {
        return 'Rejected';
      } else if (this.get('model.parent') && !this.get('model.parent.isSettled')) {
        return 'Waiting for parent';
      } else {
        return 'Pending';
      }
    }),

    timeToSettle: computed('model.createdAt', 'model.settledAt', 'model.parent.settledAt', function () {
      if (!this.get('model.createdAt') || !this.get('model.settledAt')) {
        return ' -- ';
      }
      var startedAt = this.get('model.parent.settledAt') || this.get('model.createdAt');
      var remaining = this.get('model.settledAt').getTime() - startedAt.getTime();
      return remaining;
    })
  });
});
define('ember-inspector/components/property-field', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].TextField.extend({
    attributeBindings: ['label:data-label'],

    /**
     * The property-component instance.
     * Passed through the template.
     *
     * @property propertyComponent
     * @type {Ember.Component}
     */
    properyComponent: null,

    didInsertElement: function didInsertElement() {
      this.$().select();
      return this._super.apply(this, arguments);
    },

    insertNewline: function insertNewline() {
      this.get('propertyComponent').send(this.get('save-property'));
      this.get('propertyComponent').send(this.get('finished-editing'));
    },

    cancel: function cancel() {
      this.get('propertyComponent').send(this.get('finished-editing'));
    },

    focusOut: function focusOut() {
      this.get('propertyComponent').send(this.get('finished-editing'));
    }
  });
});
define('ember-inspector/components/record-filter', ['exports', 'ember'], function (exports, _ember) {
  var computed = _ember['default'].computed;
  var Component = _ember['default'].Component;
  exports['default'] = Component.extend({
    filterValue: null,
    checked: computed('filterValue', 'model.name', function () {
      return this.get('filterValue') === this.get('model.name');
    })
  });
});
define('ember-inspector/components/record-item', ['exports', 'ember', 'ember-inspector/mixins/row-events'], function (exports, _ember, _emberInspectorMixinsRowEvents) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  var isEmpty = _ember['default'].isEmpty;

  var COLOR_MAP = {
    red: '#ff2717',
    blue: '#174fff',
    green: '#006400'
  };

  exports['default'] = Component.extend(_emberInspectorMixinsRowEvents['default'], {
    /**
     * No tag. This component should not affect
     * the DOM.
     *
     * @property tagName
     * @type {String}
     * @default ''
     */
    tagName: '',

    modelTypeColumns: null,

    /**
     * The index of the current row. Currently used for the
     * `RowEvents` mixin. This property is passed through
     * the template.
     *
     * @property index
     * @type {Number}
     * @default null
     */
    index: null,

    // TODO: Color record based on `color` property.
    style: computed('model.color', function () {
      var string = '';
      var colorName = this.get('model.color');
      if (!isEmpty(colorName)) {
        var color = COLOR_MAP[colorName];
        if (color) {
          string = 'color: ' + color + ';';
        }
      }
      return htmlSafe(string);
    }),

    columns: computed('modelTypeColumns.[]', 'model.columnValues', function () {
      var _this = this;

      var columns = this.get('modelTypeColumns') || [];
      return columns.map(function (col) {
        return { name: col.name, value: _this.get('model.columnValues.' + col.name) };
      });
    })
  });
});
define('ember-inspector/components/reload-button', ['exports', 'ember-inspector/components/icon-button'], function (exports, _emberInspectorComponentsIconButton) {
  exports['default'] = _emberInspectorComponentsIconButton['default'].extend({
    title: 'Reload'
  });
});
define('ember-inspector/components/render-item', ['exports', 'ember', 'ember-inspector/utils/escape-reg-exp'], function (exports, _ember, _emberInspectorUtilsEscapeRegExp) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var isEmpty = _ember['default'].isEmpty;
  var isNone = _ember['default'].isNone;
  var run = _ember['default'].run;
  var on = _ember['default'].on;
  var observer = _ember['default'].observer;
  var htmlSafe = _ember['default'].String.htmlSafe;
  var gt = computed.gt;
  var once = run.once;
  exports['default'] = Component.extend({
    tagName: '',

    search: null,

    isExpanded: false,

    expand: function expand() {
      this.set('isExpanded', true);
    },

    searchChanged: on('init', observer('search', function () {
      var search = this.get('search');
      if (!isEmpty(search)) {
        once(this, 'expand');
      }
    })),

    searchMatch: computed('search', 'name', function () {
      var search = this.get('search');
      if (isEmpty(search)) {
        return true;
      }
      var name = this.get('model.name');
      var regExp = new RegExp((0, _emberInspectorUtilsEscapeRegExp['default'])(search.toLowerCase()));
      return !!name.toLowerCase().match(regExp);
    }),

    nodeStyle: computed('searchMatch', function () {
      var style = '';
      if (!this.get('searchMatch')) {
        style = 'opacity: 0.5;';
      }
      return htmlSafe(style);
    }),

    level: computed('target.level', function () {
      var parentLevel = this.get('target.level');
      if (isNone(parentLevel)) {
        parentLevel = -1;
      }
      return parentLevel + 1;
    }),

    nameStyle: computed('level', function () {
      return htmlSafe('padding-left: ' + (+this.get('level') * 20 + 5) + 'px;');
    }),

    hasChildren: gt('model.children.length', 0),

    expandedClass: computed('hasChildren', 'isExpanded', function () {
      if (!this.get('hasChildren')) {
        return;
      }

      if (this.get('isExpanded')) {
        return 'list__cell_arrow_expanded';
      } else {
        return 'list__cell_arrow_collapsed';
      }
    }),

    readableTime: computed('model.timestamp', function () {
      var d = new Date(this.get('model.timestamp'));
      var ms = d.getMilliseconds();
      var seconds = d.getSeconds();
      var minutes = d.getMinutes().toString().length === 1 ? '0' + d.getMinutes() : d.getMinutes();
      var hours = d.getHours().toString().length === 1 ? '0' + d.getHours() : d.getHours();

      return hours + ':' + minutes + ':' + seconds + ':' + ms;
    }),

    actions: {
      toggleExpand: function toggleExpand() {
        this.toggleProperty('isExpanded');
      }
    }
  });
});
define('ember-inspector/components/resizable-column', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  exports['default'] = Component.extend({
    width: null,

    attributeBindings: ['style'],

    style: computed('width', function () {
      return htmlSafe('-webkit-flex: none; flex: none; width: ' + this.get('width') + 'px;');
    }),

    didInsertElement: function didInsertElement() {
      if (!this.get('width')) {
        this.set('width', this.$().width());
      }
    }
  });
});
define('ember-inspector/components/route-item', ['exports', 'ember', 'ember-inspector/utils/check-current-route'], function (exports, _ember, _emberInspectorUtilsCheckCurrentRoute) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  exports['default'] = Component.extend({
    // passed as an attribute to the component
    currentRoute: null,

    /**
     * No tag. This component should not affect
     * the DOM.
     *
     * @property tagName
     * @type {String}
     * @default ''
     */
    tagName: '',

    labelStyle: computed('model.parentCount', function () {
      return htmlSafe('padding-left: ' + (+this.get('model.parentCount') * 20 + 5) + 'px;');
    }),

    isCurrent: computed('currentRoute', 'model.value.name', function () {
      var currentRoute = this.get('currentRoute');
      if (!currentRoute) {
        return false;
      }

      return (0, _emberInspectorUtilsCheckCurrentRoute['default'])(currentRoute, this.get('model.value.name'));
    })
  });
});
define('ember-inspector/components/send-to-console', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Component.extend({
    tagName: 'button',
    classNames: ['send-to-console', 'js-send-to-console-btn'],
    action: 'sendValueToConsole',
    click: function click() {
      this.sendAction('action', this.get('param'));
    }
  });
});
define('ember-inspector/components/sidebar-toggle', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Component.extend({

    tagName: 'button',

    side: 'right',

    isExpanded: false,

    isRight: _ember['default'].computed.equal('side', 'right'),

    classNames: 'sidebar-toggle',

    classNameBindings: 'isRight:sidebar-toggle--right:sidebar-toggle--left',

    click: function click() {
      this.sendAction();
    }

  });
});
define('ember-inspector/components/vertical-collection', ['exports', 'smoke-and-mirrors/components/vertical-collection'], function (exports, _smokeAndMirrorsComponentsVerticalCollection) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _smokeAndMirrorsComponentsVerticalCollection['default'];
    }
  });
});
define('ember-inspector/components/vertical-item', ['exports', 'smoke-and-mirrors/components/vertical-item'], function (exports, _smokeAndMirrorsComponentsVerticalItem) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _smokeAndMirrorsComponentsVerticalItem['default'];
    }
  });
});
define('ember-inspector/components/view-item', ['exports', 'ember', 'ember-inspector/mixins/row-events'], function (exports, _ember, _emberInspectorMixinsRowEvents) {
  var computed = _ember['default'].computed;
  var Component = _ember['default'].Component;
  var htmlSafe = _ember['default'].String.htmlSafe;
  var not = computed.not;
  var bool = computed.bool;
  var equal = computed.equal;
  exports['default'] = Component.extend(_emberInspectorMixinsRowEvents['default'], {
    /**
     * No tag. This component should not affect
     * the DOM.
     *
     * @property tagName
     * @type {String}
     * @default ''
     */
    tagName: '',

    /**
     * Has a view (component) instance.
     *
     * @property hasView
     * @type {Boolean}
     */
    hasView: bool('model.value.viewClass'),

    /**
     * Whether it has a tag or not.
     *
     * @property isTagless
     * @type {Boolean}
     */
    isTagless: equal('model.value.tagName', ''),

    /**
     * Whether it has an element or not (depends on the tagName).
     *
     * @property hasElement
     * @type {Boolean}
     */
    hasElement: not('isTagless'),

    /**
     * Whether it has a layout/template or not.
     *
     * @property hasTemplate
     * @type {Boolean}
     */
    hasTemplate: bool('model.value.template'),

    hasModel: bool('model.value.model'),

    hasController: bool('model.value.controller'),

    /**
     * The index of the current row. Currently used for the
     * `RowEvents` mixin. This property is passed through
     * the template.
     *
     * @property index
     * @type {Number}
     * @default null
     */
    index: null,

    modelInspectable: computed('hasModel', 'model.value.model.type', function () {
      return this.get('hasModel') && this.get('model.value.model.type') === 'type-ember-object';
    }),

    labelStyle: computed('model.parentCount', function () {
      return htmlSafe('padding-left: ' + (+this.get('model.parentCount') * 20 + 5) + 'px;');
    }),

    actions: {
      inspectView: function inspectView() {
        if (this.get('hasView')) {
          this.sendAction('inspect', this.get('model.value.objectId'));
        }
      },
      inspectElement: function inspectElement(objectId) {
        var elementId = undefined;
        if (!objectId && this.get('hasElement')) {
          objectId = this.get('model.value.objectId');
        }
        if (!objectId) {
          elementId = this.get('model.value.elementId');
        }
        if (objectId || elementId) {
          this.sendAction('inspectElement', { objectId: objectId, elementId: elementId });
        }
      },
      inspectModel: function inspectModel(objectId) {
        if (this.get('modelInspectable')) {
          this.sendAction('inspect', objectId);
        }
      }
    }
  });
});
define('ember-inspector/components/x-app', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var not = _ember['default'].computed.not;
  exports['default'] = Component.extend({
    classNames: ['app'],

    classNameBindings: ['inactive', 'isDragging'],

    attributeBindings: ['tabindex'],
    tabindex: 1,

    isDragging: false,

    /**
     * Bound to application controller.
     *
     * @property active
     * @type {Boolean}
     * @default false
     */
    active: false,

    inactive: not('active'),

    focusIn: function focusIn() {
      if (!this.get('active')) {
        this.set('active', true);
      }
    },

    focusOut: function focusOut() {
      if (this.get('active')) {
        this.set('active', false);
      }
    }
  });
});
define('ember-inspector/components/x-list-cell', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var K = _ember['default'].K;
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  exports['default'] = Component.extend({
    /**
     * Defaults to a table cell. For headers
     * set it to `th` by passing it through the
     * template.
     *
     * @property tagName
     * @type {String}
     * @default 'td'
     */
    tagName: 'td',

    /**
     * @property classNames
     * @type {Array}
     */
    classNames: ['list__cell'],

    /**
     * `highlight` and `clickable` or class modifiers.
     *
     * @property classNameBindings
     * @type {Array}
     */
    classNameBindings: ['highlight:list__cell_highlight', 'clickable:list__cell_clickable'],

    /**
     * Style passed through the `style` property
     * should end up as the DOM element's style.
     * Same applies to the `title` attribute.
     *
     * @property attributeBindings
     * @type {Array}
     */
    attributeBindings: ['safeStyle:style', 'title'],

    /**
     * Avoid unsafe style warning. This property does not
     * depend on user input so this is safe.
     *
     * @property safeStyle
     * @type {SafeString}
     */
    safeStyle: computed('style', function () {
      return htmlSafe(this.get('style'));
    }),

    /**
     * The `title` attribute of the DOM element.
     *
     * @property title
     * @type {String}
     * @default null
     */
    title: null,

    /**
     * The `style` attribute of the DOM element.
     *
     * @property style
     * @type {String}
     * @default null
     */
    style: null,

    /**
     * Cells can be clickable. One example would be clicking Data records to
     * inspect them in the object inspector. Set this property to `true` to
     * make this cell appear clickable (pointer cursor, underline...).
     *
     * @property clickable
     * @type {Boolean}
     * @default false
     */
    clickable: false,

    /**
     * Set this property to `true` to highlight the cell. For example
     * the current route in the Routes tab is highlighted.
     *
     * @property highlight
     * @type {Boolean}
     * @default false
     */
    highlight: false,

    /**
     * Action to trigger when the cell is clicked.
     * Pass the action through the template using the `action`
     * helper.
     *
     * @property on-click
     * @type {Function}
     */
    'on-click': K,

    /**
     * DOM event triggered when cell is clicked.
     * Calls the `on-click` action (if set).
     *
     * @method click
     */
    click: function click() {
      this.get('on-click')();
    }
  });
});
/**
 * An individual cell for the `x-list` table.
 * Usually not called directly but as a contextual helper.
 *
 * For example:
 *
 * ```javascript
 * {{#x-list as |list|}}
 *   <tr>
 *     {{#each model as |item|}}
 *       {{list.cell}} {{item.name}} {{/list.cell}}
 *     {{/each}}
 *   </tr>
 * {{/xlist}}
 * ```
 */
define('ember-inspector/components/x-list-content', ['exports', 'ember'], function (exports, _ember) {
  var Component = _ember['default'].Component;
  var computed = _ember['default'].computed;
  var htmlSafe = _ember['default'].String.htmlSafe;
  var Evented = _ember['default'].Evented;
  var $ = _ember['default'].$;
  var run = _ember['default'].run;
  var EmberObject = _ember['default'].Object;
  var inject = _ember['default'].inject;
  var schedule = run.schedule;
  var service = inject.service;

  /**
   * Base list view config
   *
   * @module Components
   * @extends Component
   * @class List
   * @namespace Components
   */
  exports['default'] = Component.extend(Evented, {
    /**
     * The layout service. Used to observe the app's content height.
     *
     * @property layoutService
     * @type {Service}
     */
    layoutService: service('layout'),

    /**
     * @property classNames
     * @type {Array}
     */
    classNames: ["list__content", "js-list-content"],

    /**
     * Hook called when content element is inserted.
     * Used to setup event listeners to work-around
     * smoke-and-mirrors lack of events.
     *
     * @method didInsertElement
     */
    didInsertElement: function didInsertElement() {
      schedule('afterRender', this, this.setupHeight);
      schedule('afterRender', this, this.setupEvents);
    },

    /**
     * Set up the content height and listen to any updates to that property.
     *
     * @method setupHeight
     */
    setupHeight: function setupHeight() {
      this.set('contentHeight', this.get('layoutService.contentHeight'));
      this.get('layoutService').on('content-height-update', this, this.updateContentHeight);
    },

    /**
     * Triggered whenever the app's content height changes. This usually happens
     * when the window is resized. Once we detect a change we:
     * 1. Update this component's `contentHeight` property and consequently its `height` style.
     * 2. Check the previous height. If previous height was zero that means the inspector launched
     * in the background and was therefore not visible. Go to (a). Otherwise skip (a).
     *   a. Rerender the component. This is needed because smoke and mirrors doesn't know that the content height
     *   has changed.
     *
     * @method updateContentHeight
     * @param  {Number} height The app's new content height
     */
    updateContentHeight: function updateContentHeight(height) {
      var previousHeight = this.get('contentHeight');
      this.set('contentHeight', height);
      if (previousHeight === 0 && height > 0) {
        this.rerender();
      }
    },

    /**
     * Set up event listening on the individual rows in the table.
     * Rows can listen to these events by listening to events on the `rowEvents`
     * property.
     *
     * @method setupEvents
     */
    setupEvents: function setupEvents() {
      this.set('rowEvents', EmberObject.extend(Evented).create());
      this.$().on('click mouseleave mouseenter', 'tr', run.bind(this, 'triggerRowEvent'));
    },

    /**
     * Hook called before destruction. Clean up events listeners.
     *
     * @method willDestroyElement
     */
    willDestroyElement: function willDestroyElement() {
      this.get('layoutService').off('content-height-update', this, this.updateContentHeight);
      return this._super.apply(this, arguments);
    },

    /**
     * Broadcasts that an event was triggered on a row.
     *
     * @method triggerRowEvent
     * @param {Object}
     *  - {String} type The event type to trigger
     *  - {DOMElement} currentTarget The element the event was triggered on
     */
    triggerRowEvent: function triggerRowEvent(_ref) {
      var type = _ref.type;
      var currentTarget = _ref.currentTarget;

      this.get('rowEvents').trigger(type, { index: $(currentTarget).index(), type: type });
    },

    attributeBindings: ['style'],

    style: computed('height', function () {
      return htmlSafe('height:' + this.get('height') + 'px');
    }),

    /**
     * Array of objects representing the columns to render
     * and their corresponding widths. This array is passed
     * through the template.
     *
     * Each item in the array has `width` and `id` properties.
     *
     * @property columns
     * @type {Array}
     */
    columns: computed(function () {
      return [];
    }),

    /**
     * Number passed from `x-list`. Indicates the header height
     * in pixels.
     *
     * @property headerHeight
     * @type {Number}
     */
    headerHeight: null,

    /**
     * @property height
     * @type {Integer}
     */
    height: computed('contentHeight', 'headerHeight', function () {
      var headerHeight = this.get('headerHeight');
      var contentHeight = this.get('contentHeight');

      // In testing list-view is created before `contentHeight` is set
      // which will trigger an exception
      if (!contentHeight) {
        return 1;
      }
      return contentHeight - headerHeight;
    })
  });
});
define('ember-inspector/components/x-list', ['exports', 'ember', 'ember-concurrency', 'ember-inspector/libs/resizable-columns'], function (exports, _ember, _emberConcurrency, _emberInspectorLibsResizableColumns) {
  var Component = _ember['default'].Component;
  var run = _ember['default'].run;
  var computed = _ember['default'].computed;
  var inject = _ember['default'].inject;
  var $ = _ember['default'].$;
  var scheduleOnce = run.scheduleOnce;
  var service = inject.service;
  var readOnly = computed.readOnly;
  var reads = computed.reads;

  var CHECK_HTML = '&#10003;';
  var LOCAL_STORAGE_SUPPORTED = undefined;
  try {
    LOCAL_STORAGE_SUPPORTED = !!window.localStorage;
  } catch (e) {
    // Security setting in chrome that disables storage for third party
    // throws an error when `localStorage` is accessed.
    LOCAL_STORAGE_SUPPORTED = false;
  }

  exports['default'] = Component.extend({
    /**
     * @property classNames
     * @type {Array}
     */
    classNames: ['list'],

    /**
     * Class to pass to each row in `vertical-collection`.
     *
     * @property itemClass
     * @type {String}
     * @default ''
     */
    itemClass: '',

    /**
     * Layout service used to listen to changes to the application
     * layout such as resizing of the main nav or object inspecto.
     *
     * @property layout
     * @type {Service}
     */
    layout: service(),

    /**
     * Indicate the table's header's height in pixels.
     * Set this to `0` when there's no header.
     *
     * @property headerHeight
     * @type {Number}
     * @default 31
     */
    headerHeight: 31,

    /**
     * The name of the list. Used for `js-` classes added
     * to elements of the list. Also used as the default
     * key for schema caching.
     *
     * @property name
     * @type {String}
     */
    name: null,

    /**
     * Service used for storage. Storage is
     * needed for caching of widths and visibility of columns.
     * The default storage service is local storage however we
     * fall back to memory storage if local storage is disabled (For
     * example as a security setting in Chrome).
     *
     * @property storage
     * @return {Service}
     */
    storage: service('storage/' + (LOCAL_STORAGE_SUPPORTED ? 'local' : 'memory')),

    /**
     * The key used to cache the current schema. Defaults
     * to the list's name.
     *
     * @property storageKey
     * @type {String}
     */
    storageKey: reads('name'),

    /**
     * The schema that contains the list's columns,
     * their ids, names, and default visibility.
     *
     * @property schema
     * @type {Object}
     */
    schema: null,

    /**
     * The array of columns including their ids, names,
     * and widths. This array only contains the currently
     * visible columns.
     *
     * @property columns
     * @type {Array}
     */
    columns: readOnly('resizableColumns.columns'),

    /**
     * Hook called whenever attributes are updated.
     * We use this to listen to changes to the schema.
     * If the schema changes for an existing `x-list` component
     * (happens when switching model types for example), we need
     * to rebuild the columns from scratch.
     *
     * @method didUpdateAttrs
     * @param  {Object} newAttrs and oldAttrs
     */
    didUpdateAttrs: function didUpdateAttrs(_ref) {
      var newSchema = _ref.newAttrs.schema;
      var oldSchema = _ref.oldAttrs.schema;

      if (newSchema && newSchema !== oldSchema) {
        scheduleOnce('actions', this, this.setupColumns);
      }
      return this._super.apply(this, arguments);
    },

    /**
     * The instance responsible for building the `columns`
     * array. This means that this instance controls
     * the widths of the columns as well as their visibility.
     *
     * @property resizableColumns
     * @type {ResizableColumn}
     */
    resizableColumns: null,

    /**
     * The minimum width a column can be resized to.
     * It should be high enough so that the column is still
     * visible and resizable.
     *
     * @property minWidth
     * @type {Number}
     * @default 10
     */
    minWidth: 10,

    didInsertElement: function didInsertElement() {
      var _this = this;

      scheduleOnce('afterRender', this, this.setupColumns);
      this.onResize = function () {
        _this.get('debounceColumnWidths').perform();
      };
      $(window).on('resize.' + this.get('elementId'), this.onResize);
      this.get('layout').on('resize', this.onResize);
      return this._super.apply(this, arguments);
    },

    /**
     * Setup the context menu which allows the user
     * to toggle the visibility of each column.
     *
     * The context menu opened by right clicking on the table's
     * header.
     *
     * @method setupContextMenu
     */
    setupContextMenu: function setupContextMenu() {
      var _this2 = this;

      var menu = this.resizableColumns.getColumnVisibility().reduce(function (arr, _ref2) {
        var id = _ref2.id;
        var name = _ref2.name;
        var visible = _ref2.visible;

        var check = '' + CHECK_HTML;
        if (!visible) {
          check = '<span style=\'opacity:0\'>' + check + '</span>';
        }
        name = check + ' ' + name;
        arr.push({
          name: name,
          title: name,
          fun: run.bind(_this2, _this2.toggleColumnVisibility, id)
        });
        return arr;
      }, []);

      this.$('.list__header').contextMenu(menu, { triggerOn: 'contextmenu' });
    },

    /**
     * Toggle a column's visibility. This is called
     * when a user clicks on a specific column in the context
     * menu. After toggling visibility it destroys the current
     * context menu and rebuilds it with the updated column data.
     *
     * @method toggleColumnVisibility
     * @param {String} id The column's id
     */
    toggleColumnVisibility: function toggleColumnVisibility(id) {
      this.resizableColumns.toggleVisibility(id);
      this.$('.list__header').contextMenu('destroy');
      this.setupContextMenu();
    },

    /**
     * Restartable `ember-concurrency` task called whenever
     * the table widths need to be recalculated due to some
     * resizing of the window or application.
     *
     * @property debounceColumnWidths
     * @type {Object} Ember Concurrency task
     */
    debounceColumnWidths: (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$0$0() {
      return regeneratorRuntime.wrap(function callee$0$0$(context$1$0) {
        while (1) switch (context$1$0.prev = context$1$0.next) {
          case 0:
            context$1$0.next = 2;
            return (0, _emberConcurrency.timeout)(100);

          case 2:
            this.resizableColumns.setTableWidth(this.getTableWidth());

          case 3:
          case 'end':
            return context$1$0.stop();
        }
      }, callee$0$0, this);
    })).restartable(),

    /**
     * Hook called when the component element will be destroyed.
     * Clean up everything.
     *
     * @method willDestroyElement
     */
    willDestroyElement: function willDestroyElement() {
      _ember['default'].$(window).off('.' + this.get('elementId'));
      this.$('.list__header').contextMenu('destroy');
      this.get('layout').off('resize', this.onResize);
      return this._super.apply(this, arguments);
    },

    /**
     * Returns the table's width in pixels.
     *
     * @method getTableWidth
     * @return {Number} The width in pixels
     */
    getTableWidth: function getTableWidth() {
      return this.$('.list__table-container').innerWidth();
    },

    /**
     * Creates a new `ResizableColumns` instance which
     * will calculate the columns' width and visibility.
     *
     * @method setupColumns
     */
    setupColumns: function setupColumns() {
      var resizableColumns = new _emberInspectorLibsResizableColumns['default']({
        key: this.get('storageKey'),
        tableWidth: this.getTableWidth(),
        minWidth: this.get('minWidth'),
        storage: this.get('storage'),
        columnSchema: this.get('schema.columns') || []
      });
      resizableColumns.build();
      this.set('resizableColumns', resizableColumns);
      this.setupContextMenu();
    },

    actions: {
      /**
       * Called whenever a column is resized using the draggable handle.
       * It is responsible for updating the column info by notifying
       * `resizableColumns` about the update.
       *
       * @method didResize
       * @param {String} id The column's id
       * @param {Number} width The new width
       */
      didResize: function didResize(id, width) {
        this.resizableColumns.updateColumnWidth(id, width);
      }
    }
  });
});
define("ember-inspector/computed/debounce", ["exports", "ember", "ember-new-computed"], function (exports, _ember, _emberNewComputed) {
  var run = _ember["default"].run;
  var debounce = run.debounce;

  // Use this if you want a property to debounce
  // another property with a certain delay.
  // This means that every time this prop changes,
  // the other prop will change to the same val after [delay]

  exports["default"] = function (prop, delay, callback) {
    var value = undefined;

    var updateVal = function updateVal() {
      this.set(prop, value);
      if (callback) {
        callback.call(this);
      }
    };

    return (0, _emberNewComputed["default"])({
      get: function get() {},
      set: function set(key, val) {
        value = val;
        debounce(this, updateVal, delay);
        return val;
      }
    });
  };
});
define('ember-inspector/controllers/application', ['exports', 'ember'], function (exports, _ember) {
  var Controller = _ember['default'].Controller;
  var computed = _ember['default'].computed;
  var equal = _ember['default'].computed.equal;
  exports['default'] = Controller.extend({
    isDragging: false,
    contentHeight: null,
    emberApplication: false,
    navWidth: 180,
    inspectorWidth: 360,
    mixinStack: computed(function () {
      return [];
    }),
    mixinDetails: computed(function () {
      return [];
    }),
    isChrome: equal('port.adapter.name', 'chrome'),

    deprecationCount: 0,

    // Indicates that the extension window is focused,
    active: true,

    inspectorExpanded: false,

    pushMixinDetails: function pushMixinDetails(name, property, objectId, details, errors) {
      details = {
        name: name,
        property: property,
        objectId: objectId,
        mixins: details,
        errors: errors
      };

      this.get('mixinStack').pushObject(details);
      this.set('mixinDetails', details);
    },

    popMixinDetails: function popMixinDetails() {
      var mixinStack = this.get('mixinStack');
      var item = mixinStack.popObject();
      this.set('mixinDetails', mixinStack.get('lastObject'));
      this.get('port').send('objectInspector:releaseObject', { objectId: item.objectId });
    },

    activateMixinDetails: function activateMixinDetails(name, objectId, details, errors) {
      var _this = this;

      this.get('mixinStack').forEach(function (item) {
        _this.get('port').send('objectInspector:releaseObject', { objectId: item.objectId });
      });

      this.set('mixinStack', []);
      this.pushMixinDetails(name, undefined, objectId, details, errors);
    },

    droppedObject: function droppedObject(objectId) {
      var mixinStack = this.get('mixinStack');
      var obj = mixinStack.findBy('objectId', objectId);
      if (obj) {
        var index = mixinStack.indexOf(obj);
        var objectsToRemove = [];
        for (var i = index; i >= 0; i--) {
          objectsToRemove.pushObject(mixinStack.objectAt(i));
        }
        objectsToRemove.forEach(function (item) {
          mixinStack.removeObject(item);
        });
      }
      if (mixinStack.get('length') > 0) {
        this.set('mixinDetails', mixinStack.get('lastObject'));
      } else {
        this.set('mixinDetails', null);
      }
    }
  });
});
define("ember-inspector/controllers/container-type", ["exports", "ember", "ember-inspector/computed/debounce", "ember-inspector/utils/search-match"], function (exports, _ember, _emberInspectorComputedDebounce, _emberInspectorUtilsSearchMatch) {
  var Controller = _ember["default"].Controller;
  var computed = _ember["default"].computed;
  var get = _ember["default"].get;
  var controller = _ember["default"].inject.controller;
  var filter = computed.filter;
  exports["default"] = Controller.extend({
    application: controller(),

    sortProperties: ['name'],

    searchVal: (0, _emberInspectorComputedDebounce["default"])('search', 300),

    search: null,

    filtered: filter('model', function (item) {
      return (0, _emberInspectorUtilsSearchMatch["default"])(get(item, 'name'), this.get('search'));
    }).property('model.@each.name', 'search'),

    actions: {
      /**
       * Inspect an instance in the object inspector.
       * Called whenever an item in the list is clicked.
       *
       * @method inspectInstance
       * @param {Object} obj
       */
      inspectInstance: function inspectInstance(obj) {
        if (!get(obj, 'inspectable')) {
          return;
        }
        this.get('port').send('objectInspector:inspectByContainerLookup', { name: get(obj, 'fullName') });
      }
    }
  });
});
define('ember-inspector/controllers/container-types', ['exports', 'ember'], function (exports, _ember) {
  var Controller = _ember['default'].Controller;
  var sort = _ember['default'].computed.sort;
  exports['default'] = Controller.extend({
    sortProperties: ['name'],
    sorted: sort('model', 'sortProperties')
  });
});
define("ember-inspector/controllers/deprecations", ["exports", "ember", "ember-inspector/computed/debounce", "ember-inspector/utils/search-match"], function (exports, _ember, _emberInspectorComputedDebounce, _emberInspectorUtilsSearchMatch) {
  var Controller = _ember["default"].Controller;
  var computed = _ember["default"].computed;
  var get = _ember["default"].get;
  var controller = _ember["default"].inject.controller;
  var filter = computed.filter;
  exports["default"] = Controller.extend({
    /**
     * Used by the view for content height calculation
     *
     * @property application
     * @type {Controller}
     */
    application: controller(),
    search: null,
    searchVal: (0, _emberInspectorComputedDebounce["default"])('search', 300),
    filtered: filter('model', function (item) {
      return (0, _emberInspectorUtilsSearchMatch["default"])(get(item, 'message'), this.get('search'));
    }).property('model.@each.message', 'search'),
    actions: {
      openResource: function openResource(item) {
        this.get('adapter').openResource(item.fullSource, item.line);
      },

      traceSource: function traceSource(deprecation, source) {
        this.get('port').send('deprecation:sendStackTraces', {
          deprecation: {
            message: deprecation.message,
            sources: [source]
          }
        });
      },

      traceDeprecations: function traceDeprecations(deprecation) {
        this.get('port').send('deprecation:sendStackTraces', {
          deprecation: deprecation
        });
      }
    }
  });
});
define('ember-inspector/controllers/info', ['exports', 'ember'], function (exports, _ember) {
  var Controller = _ember['default'].Controller;
  var controller = _ember['default'].inject.controller;
  exports['default'] = Controller.extend({
    application: controller()
  });
});
define('ember-inspector/controllers/model-types', ['exports', 'ember'], function (exports, _ember) {
  var Controller = _ember['default'].Controller;
  var computed = _ember['default'].computed;
  var get = _ember['default'].get;
  var inject = _ember['default'].inject;
  var sort = computed.sort;
  var controller = inject.controller;
  exports['default'] = Controller.extend({
    application: controller(),
    navWidth: 180,
    sortProperties: ['name'],
    options: {
      hideEmptyModelTypes: false
    },

    sorted: sort('filtered', 'sortProperties'),

    filtered: computed('model.@each.count', 'options.hideEmptyModelTypes', function () {
      var _this = this;

      return this.get('model').filter(function (item) {
        var hideEmptyModels = get(_this, 'options.hideEmptyModelTypes');

        if (hideEmptyModels) {
          return !!get(item, 'count');
        } else {
          return true;
        }
      });
    })
  });
});
define('ember-inspector/controllers/promise-tree', ['exports', 'ember'], function (exports, _ember) {
  var _slice = Array.prototype.slice;
  var Controller = _ember['default'].Controller;
  var computed = _ember['default'].computed;
  var observer = _ember['default'].observer;
  var run = _ember['default'].run;
  var controller = _ember['default'].inject.controller;
  var isEmpty = _ember['default'].isEmpty;
  var equal = computed.equal;
  var bool = computed.bool;
  var and = computed.and;
  var not = computed.not;
  var filter = computed.filter;
  var next = run.next;
  var once = run.once;
  var debounce = run.debounce;
  exports['default'] = Controller.extend({
    application: controller(),

    queryParams: ['filter'],

    createdAfter: null,

    // below used to show the "refresh" message
    isEmpty: equal('model.length', 0),
    wasCleared: bool('createdAfter'),
    neverCleared: not('wasCleared'),
    shouldRefresh: and('isEmpty', 'neverCleared'),

    // Keep track of promise stack traces.
    // It is opt-in due to performance reasons.
    instrumentWithStack: false,

    /* jscs:disable validateIndentation */
    filtered: filter('model.@each.{createdAt,fulfilledBranch,rejectedBranch,pendingBranch,isVisible}', function (item) {

      // exclude cleared promises
      if (this.get('createdAfter') && item.get('createdAt') < this.get('createdAfter')) {
        return false;
      }

      if (!item.get('isVisible')) {
        return false;
      }

      // Exclude non-filter complying promises
      // If at least one of their children passes the filter,
      // then they pass
      var include = true;
      if (this.get('filter') === 'pending') {
        include = item.get('pendingBranch');
      } else if (this.get('filter') === 'rejected') {
        include = item.get('rejectedBranch');
      } else if (this.get('filter') === 'fulfilled') {
        include = item.get('fulfilledBranch');
      }
      if (!include) {
        return false;
      }

      // Search filter
      // If they or at least one of their children
      // match the search, then include them
      var search = this.get('effectiveSearch');
      if (!isEmpty(search)) {
        return item.matches(search);
      }
      return true;
    }),
    /* jscs:enable validateIndentation */

    filter: 'all',

    noFilter: equal('filter', 'all'),
    isRejectedFilter: equal('filter', 'rejected'),
    isPendingFilter: equal('filter', 'pending'),
    isFulfilledFilter: equal('filter', 'fulfilled'),

    search: null,
    effectiveSearch: null,

    searchChanged: observer('search', function () {
      debounce(this, this.notifyChange, 500);
    }),

    notifyChange: function notifyChange() {
      var _this = this;

      this.set('effectiveSearch', this.get('search'));
      next(function () {
        _this.notifyPropertyChange('model');
      });
    },

    actions: {
      setFilter: function setFilter(filter) {
        var _this2 = this;

        this.set('filter', filter);
        next(function () {
          _this2.notifyPropertyChange('filtered');
        });
      },
      clear: function clear() {
        this.set('createdAfter', new Date());
        once(this, this.notifyChange);
      },
      tracePromise: function tracePromise(promise) {
        this.get('port').send('promise:tracePromise', { promiseId: promise.get('guid') });
      },
      updateInstrumentWithStack: function updateInstrumentWithStack(bool) {
        this.port.send('promise:setInstrumentWithStack', { instrumentWithStack: bool });
      },
      toggleExpand: function toggleExpand(promise) {
        var isExpanded = !promise.get('isExpanded');
        promise.set('isManuallyExpanded', isExpanded);
        promise.recalculateExpanded();
        var children = promise._allChildren();
        if (isExpanded) {
          children.forEach(function (child) {
            var isManuallyExpanded = child.get('isManuallyExpanded');
            if (isManuallyExpanded === undefined) {
              child.set('isManuallyExpanded', isExpanded);
              child.recalculateExpanded();
            }
          });
        }
      },
      inspectObject: function inspectObject() {
        var _get;

        (_get = this.get('target')).send.apply(_get, ['inspectObject'].concat(_slice.call(arguments)));
      },
      sendValueToConsole: function sendValueToConsole(promise) {
        this.get('port').send('promise:sendValueToConsole', { promiseId: promise.get('guid') });
      }
    }
  });
});
define("ember-inspector/controllers/records", ["exports", "ember", "ember-inspector/utils/escape-reg-exp"], function (exports, _ember, _emberInspectorUtilsEscapeRegExp) {
  var Controller = _ember["default"].Controller;
  var computed = _ember["default"].computed;
  var observer = _ember["default"].observer;
  var controller = _ember["default"].inject.controller;
  var String = _ember["default"].String;
  var none = computed.none;
  var readOnly = computed.readOnly;
  var dasherize = String.dasherize;

  var get = _ember["default"].get;

  exports["default"] = Controller.extend({
    application: controller(),

    queryParams: ['filterValue', 'search'],

    columns: readOnly('modelType.columns'),

    search: '',

    filters: computed(function () {
      return [];
    }),

    filterValue: null,

    noFilterValue: none('filterValue'),

    modelChanged: observer('model', function () {
      this.set('search', '');
    }),

    recordToString: function recordToString(record) {
      var search = '';
      var searchKeywords = get(record, 'searchKeywords');
      if (searchKeywords) {
        search = get(record, 'searchKeywords').join(' ');
      }
      return search.toLowerCase();
    },

    /**
     * The number of columns to show by default. Since a specific's model's
     * column count is unknown, we only show the first 5 by default.
     * The visibility can be modified on the list level itself.
     *
     * @property columnLimit
     * @type {Number}
     * @default 5
     */
    columnLimit: 5,

    /**
     * The lists's schema containing info about the list's columns.
     * This is usually a static object except in this case each model
     * type has different columns so we need to build it dynamically.
     *
     * The format is:
     * ```js
     * {
     *   columns: [{
     *     id: 'title',
     *     name: 'Title',
     *     visible: true
     *   }]
     * }
     * ```
     *
     * @property schema
     * @type {Object}
     */
    schema: computed('columns', function () {
      var _this = this;

      var columns = this.get('columns').map(function (_ref, index) {
        var desc = _ref.desc;
        return {
          id: dasherize(desc),
          name: desc,
          visible: index < _this.get('columnLimit')
        };
      });
      return { columns: columns };
    }),

    filtered: computed('search', 'model.@each.columnValues', 'model.@each.filterValues', 'filterValue', function () {
      var _this2 = this;

      var search = this.get('search');
      var filter = this.get('filterValue');
      return this.get('model').filter(function (item) {
        // check filters
        if (filter && !get(item, "filterValues." + filter)) {
          return false;
        }

        // check search
        if (!_ember["default"].isEmpty(search)) {
          var searchString = _this2.recordToString(item);
          return !!searchString.match(new RegExp(".*" + (0, _emberInspectorUtilsEscapeRegExp["default"])(search.toLowerCase()) + ".*"));
        }
        return true;
      });
    }),

    actions: {
      /**
       * Called whenever the filter is updated.
       *
       * @method setFilter
       * @param {String} val
       */
      setFilter: function setFilter(val) {
        val = val || null;
        this.set('filterValue', val);
      },

      /**
       * Inspect a specific record. Called when a row
       * is clicked.
       *
       * @method inspectModel
       * @property {Object}
       */
      inspectModel: function inspectModel(model) {
        this.get('port').send('data:inspectModel', { objectId: _ember["default"].get(model, 'objectId') });
      }
    }
  });
});
define("ember-inspector/controllers/render-tree", ["exports", "ember", "ember-inspector/utils/escape-reg-exp", "ember-inspector/computed/debounce"], function (exports, _ember, _emberInspectorUtilsEscapeRegExp, _emberInspectorComputedDebounce) {
  var computed = _ember["default"].computed;
  var isEmpty = _ember["default"].isEmpty;
  var Controller = _ember["default"].Controller;
  var controller = _ember["default"].inject.controller;
  var and = computed.and;
  var equal = computed.equal;
  var filter = computed.filter;

  var get = _ember["default"].get;

  exports["default"] = Controller.extend({
    application: controller(),
    initialEmpty: false,
    modelEmpty: equal('model.length', 0),
    showEmpty: and('initialEmpty', 'modelEmpty'),

    // bound to the input field, updates the `search` property
    // 300ms after changing
    searchField: (0, _emberInspectorComputedDebounce["default"])('search', 300),

    // model filtered based on this value
    search: '',

    escapedSearch: computed('search', function () {
      return (0, _emberInspectorUtilsEscapeRegExp["default"])(this.get('search').toLowerCase());
    }),

    filtered: filter('model', function (item) {
      var search = this.get('escapedSearch');
      if (isEmpty(search)) {
        return true;
      }
      var regExp = new RegExp(search);
      return !!recursiveMatch(item, regExp);
    }).property('model.@each.name', 'search')
  });

  function recursiveMatch(item, regExp) {
    var children = undefined,
        child = undefined;
    var name = get(item, 'name');
    if (name.toLowerCase().match(regExp)) {
      return true;
    }
    children = get(item, 'children');
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      if (recursiveMatch(child, regExp)) {
        return true;
      }
    }
    return false;
  }
});
define("ember-inspector/controllers/route-tree", ["exports", "ember", "ember-inspector/utils/check-current-route"], function (exports, _ember, _emberInspectorUtilsCheckCurrentRoute) {
  var Controller = _ember["default"].Controller;
  var computed = _ember["default"].computed;
  var controller = _ember["default"].inject.controller;
  exports["default"] = Controller.extend({
    application: controller(),

    queryParams: ['hideRoutes'],

    currentRoute: null,
    hideRoutes: computed.alias('options.hideRoutes'),

    options: {
      hideRoutes: false
    },

    model: computed(function () {
      return [];
    }),

    filtered: computed('model.[]', 'options.hideRoutes', 'currentRoute', function () {
      var _this = this;

      return this.get('model').filter(function (routeItem) {
        var currentRoute = _this.get('currentRoute');
        var hideRoutes = _this.get('options.hideRoutes');

        if (hideRoutes && currentRoute) {
          return (0, _emberInspectorUtilsCheckCurrentRoute["default"])(currentRoute, routeItem.value.name);
        } else {
          return true;
        }
      });
    }),

    actions: {
      inspectRoute: function inspectRoute(name) {
        this.get('port').send('objectInspector:inspectRoute', { name: name });
      },
      sendRouteHandlerToConsole: function sendRouteHandlerToConsole(name) {
        this.get('port').send('objectInspector:sendRouteHandlerToConsole', { name: name });
      },
      inspectController: function inspectController(controller) {
        if (!controller.exists) {
          return;
        }
        this.get('port').send('objectInspector:inspectController', { name: controller.name });
      },
      sendControllerToConsole: function sendControllerToConsole(name) {
        this.get('port').send('objectInspector:sendControllerToConsole', { name: name });
      }
    }
  });
});
define('ember-inspector/controllers/view-tree', ['exports', 'ember'], function (exports, _ember) {
  var computed = _ember['default'].computed;
  var Controller = _ember['default'].Controller;
  var on = _ember['default'].on;
  var observer = _ember['default'].observer;
  var controller = _ember['default'].inject.controller;
  var alias = computed.alias;
  exports['default'] = Controller.extend({
    application: controller(),
    pinnedObjectId: null,
    inspectingViews: false,
    queryParams: ['components'],
    components: alias('options.components'),
    options: {
      components: false
    },

    optionsChanged: on('init', observer('options.components', function () {
      this.port.send('view:setOptions', { options: this.get('options') });
    })),

    actions: {
      previewLayer: function previewLayer(_ref) {
        var _ref$value = _ref.value;
        var objectId = _ref$value.objectId;
        var elementId = _ref$value.elementId;
        var renderNodeId = _ref$value.renderNodeId;

        // We are passing all of objectId, elementId, and renderNodeId to support post-glimmer 1, post-glimmer 2, and root for
        // post-glimmer 2
        this.get('port').send('view:previewLayer', { objectId: objectId, renderNodeId: renderNodeId, elementId: elementId });
      },

      hidePreview: function hidePreview() {
        this.get('port').send('view:hidePreview');
      },

      toggleViewInspection: function toggleViewInspection() {
        this.get('port').send('view:inspectViews', { inspect: !this.get('inspectingViews') });
      },

      sendModelToConsole: function sendModelToConsole(value) {
        // do not use `sendObjectToConsole` because models don't have to be ember objects
        this.get('port').send('view:sendModelToConsole', value);
      },

      sendObjectToConsole: function sendObjectToConsole(objectId) {
        this.get('port').send('objectInspector:sendToConsole', { objectId: objectId });
      },

      inspect: function inspect(objectId) {
        if (objectId) {
          this.get('port').send('objectInspector:inspectById', { objectId: objectId });
        }
      },

      inspectElement: function inspectElement(_ref2) {
        var objectId = _ref2.objectId;
        var elementId = _ref2.elementId;

        this.get('port').send('view:inspectElement', { objectId: objectId, elementId: elementId });
      }
    }
  });
});
define('ember-inspector/helpers/and', ['exports', 'ember', 'ember-truth-helpers/helpers/and'], function (exports, _ember, _emberTruthHelpersHelpersAnd) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersAnd.andHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersAnd.andHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/build-style', ['exports', 'ember'], function (exports, _ember) {
  exports.buildStyle = buildStyle;
  var helper = _ember['default'].Helper.helper;
  var htmlSafe = _ember['default'].String.htmlSafe;
  var keys = Object.keys;

  function buildStyle(_, options) {
    return htmlSafe(keys(options).reduce(function (style, key) {
      return '' + style + key + ':' + options[key] + ';';
    }, ''));
  }

  exports['default'] = helper(buildStyle);
});
/**
 * Helper to build a style from its options. Also returns
 * a `SafeString` which avoids the style warning. Make sure
 * you don't pass user input to this helper.
 *
 * @method buildStyle
 * @param {Array} _ not used
 * @param {Object} options The options that become styles
 * @return {String} The style sting.
 */
define('ember-inspector/helpers/cancel-all', ['exports', 'ember', 'ember-concurrency/-helpers'], function (exports, _ember, _emberConcurrencyHelpers) {
  exports.cancelHelper = cancelHelper;

  function cancelHelper(args) {
    var cancelable = args[0];
    if (!cancelable || typeof cancelable.cancelAll !== 'function') {
      _ember['default'].assert('The first argument passed to the `cancel-all` helper should be a Task or TaskGroup (without quotes); you passed ' + cancelable, false);
    }

    return (0, _emberConcurrencyHelpers.taskHelperClosure)('cancelAll', args);
  }

  exports['default'] = _ember['default'].Helper.helper(cancelHelper);
});
define('ember-inspector/helpers/eq', ['exports', 'ember', 'ember-truth-helpers/helpers/equal'], function (exports, _ember, _emberTruthHelpersHelpersEqual) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersEqual.equalHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersEqual.equalHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/escape-url', ['exports', 'ember'], function (exports, _ember) {
  exports.escapeUrl = escapeUrl;
  var helper = _ember['default'].Helper.helper;

  /**
   * Escape a url component
   *
   * @method escapeUrl
   * @param {String} url
   * @return {String} encoded url
   */

  function escapeUrl(url) {
    return encodeURIComponent(url);
  }

  exports['default'] = helper(escapeUrl);
});
define('ember-inspector/helpers/gt', ['exports', 'ember', 'ember-truth-helpers/helpers/gt'], function (exports, _ember, _emberTruthHelpersHelpersGt) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersGt.gtHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersGt.gtHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/gte', ['exports', 'ember', 'ember-truth-helpers/helpers/gte'], function (exports, _ember, _emberTruthHelpersHelpersGte) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersGte.gteHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersGte.gteHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/is-array', ['exports', 'ember', 'ember-truth-helpers/helpers/is-array'], function (exports, _ember, _emberTruthHelpersHelpersIsArray) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersIsArray.isArrayHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersIsArray.isArrayHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/lt', ['exports', 'ember', 'ember-truth-helpers/helpers/lt'], function (exports, _ember, _emberTruthHelpersHelpersLt) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersLt.ltHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersLt.ltHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/lte', ['exports', 'ember', 'ember-truth-helpers/helpers/lte'], function (exports, _ember, _emberTruthHelpersHelpersLte) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersLte.lteHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersLte.lteHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/ms-to-time', ['exports', 'ember'], function (exports, _ember) {
  var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

  exports.msToTime = msToTime;
  var helper = _ember['default'].Helper.helper;

  function msToTime(_ref) {
    var _ref2 = _slicedToArray(_ref, 1);

    var time = _ref2[0];

    if (time && !isNaN(+time)) {
      var formatted = time.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
      return formatted + 'ms';
    }
  }

  exports['default'] = helper(msToTime);
});
define('ember-inspector/helpers/not-eq', ['exports', 'ember', 'ember-truth-helpers/helpers/not-equal'], function (exports, _ember, _emberTruthHelpersHelpersNotEqual) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersNotEqual.notEqualHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersNotEqual.notEqualHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/not', ['exports', 'ember', 'ember-truth-helpers/helpers/not'], function (exports, _ember, _emberTruthHelpersHelpersNot) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersNot.notHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersNot.notHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/one-way', ['exports', 'ember'], function (exports, _ember) {
  var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

  exports.oneWay = oneWay;
  var helper = _ember['default'].Helper.helper;

  function oneWay(_ref) {
    var _ref2 = _slicedToArray(_ref, 1);

    var val = _ref2[0];

    return val;
  }

  exports['default'] = helper(oneWay);
});
/**
 * One way helper when we want to avoid two-way bound attributes.
 * This would probably not be needed once one-way becomes the default.
 *
 * @method oneWay
 * @param {Array} [val] The array containing one value.
 * @return {Any} The value passed
 */
define('ember-inspector/helpers/or', ['exports', 'ember', 'ember-truth-helpers/helpers/or'], function (exports, _ember, _emberTruthHelpersHelpersOr) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersOr.orHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersOr.orHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/helpers/perform', ['exports', 'ember', 'ember-concurrency/-task-property', 'ember-concurrency/-helpers'], function (exports, _ember, _emberConcurrencyTaskProperty, _emberConcurrencyHelpers) {
  exports.performHelper = performHelper;

  function performHelper(args, hash) {
    var task = args[0];
    if (!(task instanceof _emberConcurrencyTaskProperty.Task)) {
      _ember['default'].assert('The first argument passed to the `perform` helper should be a Task object (without quotes); you passed ' + task, false);
    }

    return (0, _emberConcurrencyHelpers.taskHelperClosure)('perform', args, hash);
  }

  exports['default'] = _ember['default'].Helper.helper(performHelper);
});
define('ember-inspector/helpers/schema-for', ['exports', 'ember'], function (exports, _ember) {
  var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

  var Helper = _ember['default'].Helper;
  var getOwner = _ember['default'].getOwner;
  exports['default'] = Helper.extend({
    compute: function compute(_ref) {
      var _ref2 = _slicedToArray(_ref, 1);

      var name = _ref2[0];

      return getOwner(this).resolveRegistration('schema:' + name);
    }
  });
});
/**
 * Helper that returns the schema based on the name passed.
 * Looks in the `app/schemas` folder. Schemas are used to
 * define columns in lists.
 *
 * @method schemaFor
 * @param {Array} [name] First element is the name of the schema
 * @return {Object} The schema
 */
define('ember-inspector/helpers/task', ['exports', 'ember'], function (exports, _ember) {
  function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

  function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

  function taskHelper(_ref) {
    var _ref2 = _toArray(_ref);

    var task = _ref2[0];

    var args = _ref2.slice(1);

    return task._curry.apply(task, _toConsumableArray(args));
  }

  exports['default'] = _ember['default'].Helper.helper(taskHelper);
});
define('ember-inspector/helpers/xor', ['exports', 'ember', 'ember-truth-helpers/helpers/xor'], function (exports, _ember, _emberTruthHelpersHelpersXor) {

  var forExport = null;

  if (_ember['default'].Helper) {
    forExport = _ember['default'].Helper.helper(_emberTruthHelpersHelpersXor.xorHelper);
  } else if (_ember['default'].HTMLBars.makeBoundHelper) {
    forExport = _ember['default'].HTMLBars.makeBoundHelper(_emberTruthHelpersHelpersXor.xorHelper);
  }

  exports['default'] = forExport;
});
define('ember-inspector/initializers/app-version', ['exports', 'ember-cli-app-version/initializer-factory', 'ember-inspector/config/environment'], function (exports, _emberCliAppVersionInitializerFactory, _emberInspectorConfigEnvironment) {
  exports['default'] = {
    name: 'App Version',
    initialize: (0, _emberCliAppVersionInitializerFactory['default'])(_emberInspectorConfigEnvironment['default'].APP.name, _emberInspectorConfigEnvironment['default'].APP.version)
  };
});
define('ember-inspector/initializers/container-debug-adapter', ['exports', 'ember-resolver/container-debug-adapter'], function (exports, _emberResolverContainerDebugAdapter) {
  exports['default'] = {
    name: 'container-debug-adapter',

    initialize: function initialize() {
      var app = arguments[1] || arguments[0];

      app.register('container-debug-adapter:main', _emberResolverContainerDebugAdapter['default']);
      app.inject('container-debug-adapter:main', 'namespace', 'application:main');
    }
  };
});
define('ember-inspector/initializers/ember-concurrency', ['exports', 'ember-concurrency'], function (exports, _emberConcurrency) {
  exports['default'] = {
    name: 'ember-concurrency',
    initialize: function initialize() {}
  };
});
// This initializer exists only to make sure that the following
// imports happen before the app boots.
define('ember-inspector/initializers/export-application-global', ['exports', 'ember', 'ember-inspector/config/environment'], function (exports, _ember, _emberInspectorConfigEnvironment) {
  exports.initialize = initialize;

  function initialize() {
    var application = arguments[1] || arguments[0];
    if (_emberInspectorConfigEnvironment['default'].exportApplicationGlobal !== false) {
      var theGlobal;
      if (typeof window !== 'undefined') {
        theGlobal = window;
      } else if (typeof global !== 'undefined') {
        theGlobal = global;
      } else if (typeof self !== 'undefined') {
        theGlobal = self;
      } else {
        // no reasonable global, just bail
        return;
      }

      var value = _emberInspectorConfigEnvironment['default'].exportApplicationGlobal;
      var globalName;

      if (typeof value === 'string') {
        globalName = value;
      } else {
        globalName = _ember['default'].String.classify(_emberInspectorConfigEnvironment['default'].modulePrefix);
      }

      if (!theGlobal[globalName]) {
        theGlobal[globalName] = application;

        application.reopen({
          willDestroy: function willDestroy() {
            this._super.apply(this, arguments);
            delete theGlobal[globalName];
          }
        });
      }
    }
  }

  exports['default'] = {
    name: 'export-application-global',

    initialize: initialize
  };
});
define('ember-inspector/initializers/raf-polyfill', ['exports', 'ember-run-raf/initializers/raf-polyfill'], function (exports, _emberRunRafInitializersRafPolyfill) {
  Object.defineProperty(exports, 'default', {
    enumerable: true,
    get: function get() {
      return _emberRunRafInitializersRafPolyfill['default'];
    }
  });
  Object.defineProperty(exports, 'initialize', {
    enumerable: true,
    get: function get() {
      return _emberRunRafInitializersRafPolyfill.initialize;
    }
  });
});
define('ember-inspector/initializers/truth-helpers', ['exports', 'ember', 'ember-truth-helpers/utils/register-helper', 'ember-truth-helpers/helpers/and', 'ember-truth-helpers/helpers/or', 'ember-truth-helpers/helpers/equal', 'ember-truth-helpers/helpers/not', 'ember-truth-helpers/helpers/is-array', 'ember-truth-helpers/helpers/not-equal', 'ember-truth-helpers/helpers/gt', 'ember-truth-helpers/helpers/gte', 'ember-truth-helpers/helpers/lt', 'ember-truth-helpers/helpers/lte'], function (exports, _ember, _emberTruthHelpersUtilsRegisterHelper, _emberTruthHelpersHelpersAnd, _emberTruthHelpersHelpersOr, _emberTruthHelpersHelpersEqual, _emberTruthHelpersHelpersNot, _emberTruthHelpersHelpersIsArray, _emberTruthHelpersHelpersNotEqual, _emberTruthHelpersHelpersGt, _emberTruthHelpersHelpersGte, _emberTruthHelpersHelpersLt, _emberTruthHelpersHelpersLte) {
  exports.initialize = initialize;

  function initialize() /* container, application */{

    // Do not register helpers from Ember 1.13 onwards, starting from 1.13 they
    // will be auto-discovered.
    if (_ember['default'].Helper) {
      return;
    }

    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('and', _emberTruthHelpersHelpersAnd.andHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('or', _emberTruthHelpersHelpersOr.orHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('eq', _emberTruthHelpersHelpersEqual.equalHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('not', _emberTruthHelpersHelpersNot.notHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('is-array', _emberTruthHelpersHelpersIsArray.isArrayHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('not-eq', _emberTruthHelpersHelpersNotEqual.notEqualHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('gt', _emberTruthHelpersHelpersGt.gtHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('gte', _emberTruthHelpersHelpersGte.gteHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('lt', _emberTruthHelpersHelpersLt.ltHelper);
    (0, _emberTruthHelpersUtilsRegisterHelper.registerHelper)('lte', _emberTruthHelpersHelpersLte.lteHelper);
  }

  exports['default'] = {
    name: 'truth-helpers',
    initialize: initialize
  };
});
define("ember-inspector/libs/promise-assembler", ["exports", "ember", "ember-inspector/models/promise"], function (exports, _ember, _emberInspectorModelsPromise) {

  var EventedMixin = _ember["default"].Evented;

  var arrayComputed = _ember["default"].computed(function () {
    return [];
  });

  var objectComputed = _ember["default"].computed(function () {
    return {};
  });

  exports["default"] = _ember["default"].Object.extend(EventedMixin, {
    all: arrayComputed,
    topSort: arrayComputed,
    topSortMeta: objectComputed,
    promiseIndex: objectComputed,

    // Used to track whether current message received
    // is the first in the request
    // Mainly helps in triggering 'firstMessageReceived' event
    firstMessageReceived: false,

    start: function start() {
      this.get('port').on('promise:promisesUpdated', this, this.addOrUpdatePromises);
      this.get('port').send('promise:getAndObservePromises');
    },

    stop: function stop() {
      this.get('port').off('promise:promisesUpdated', this, this.addOrUpdatePromises);
      this.get('port').send('promise:releasePromises');
      this.reset();
    },

    reset: function reset() {
      this.set('topSortMeta', {});
      this.set('promiseIndex', {});
      this.get('topSort').clear();

      this.set('firstMessageReceived', false);
      var all = this.get('all');
      // Lazily destroy promises
      // Allows for a smooth transition on deactivate,
      // and thus providing the illusion of better perf
      _ember["default"].run.later(this, function () {
        this.destroyPromises(all);
      }, 500);
      this.set('all', []);
    },

    destroyPromises: function destroyPromises(promises) {
      promises.forEach(function (item) {
        item.destroy();
      });
    },

    addOrUpdatePromises: function addOrUpdatePromises(message) {
      this.rebuildPromises(message.promises);

      if (!this.get('firstMessageReceived')) {
        this.set('firstMessageReceived', true);
        this.trigger('firstMessageReceived');
      }
    },

    rebuildPromises: function rebuildPromises(promises) {
      var _this = this;

      promises.forEach(function (props) {
        props = _ember["default"].copy(props);
        var childrenIds = props.children;
        var parentId = props.parent;
        delete props.children;
        delete props.parent;
        if (parentId && parentId !== props.guid) {
          props.parent = _this.updateOrCreate({ guid: parentId });
        }
        var promise = _this.updateOrCreate(props);
        if (childrenIds) {
          childrenIds.forEach(function (childId) {
            // avoid infinite recursion
            if (childId === props.guid) {
              return;
            }
            var child = _this.updateOrCreate({ guid: childId, parent: promise });
            promise.get('children').pushObject(child);
          });
        }
      });
    },

    updateTopSort: function updateTopSort(promise) {
      var topSortMeta = this.get('topSortMeta');
      var guid = promise.get('guid');
      var meta = topSortMeta[guid];
      var isNew = !meta;
      var hadParent = false;
      var hasParent = !!promise.get('parent');
      var topSort = this.get('topSort');
      var parentChanged = isNew;

      if (isNew) {
        meta = topSortMeta[guid] = {};
      } else {
        hadParent = meta.hasParent;
      }
      if (!isNew && hasParent !== hadParent) {
        // todo: implement recursion to reposition children
        topSort.removeObject(promise);
        parentChanged = true;
      }
      meta.hasParent = hasParent;
      if (parentChanged) {
        this.insertInTopSort(promise);
      }
    },

    insertInTopSort: function insertInTopSort(promise) {
      var _this2 = this;

      var topSort = this.get('topSort');
      if (promise.get('parent')) {
        var parentIndex = topSort.indexOf(promise.get('parent'));
        topSort.insertAt(parentIndex + 1, promise);
      } else {
        topSort.pushObject(promise);
      }
      promise.get('children').forEach(function (child) {
        topSort.removeObject(child);
        _this2.insertInTopSort(child);
      });
    },

    updateOrCreate: function updateOrCreate(props) {
      var guid = props.guid;
      var promise = this.findOrCreate(guid);

      promise.setProperties(props);

      this.updateTopSort(promise);

      return promise;
    },

    createPromise: function createPromise(props) {
      var promise = _emberInspectorModelsPromise["default"].create(props);
      var index = this.get('all.length');

      this.get('all').pushObject(promise);
      this.get('promiseIndex')[promise.get('guid')] = index;
      return promise;
    },

    find: function find(guid) {
      if (guid) {
        var index = this.get('promiseIndex')[guid];
        if (index !== undefined) {
          return this.get('all').objectAt(index);
        }
      } else {
        return this.get('all');
      }
    },

    findOrCreate: function findOrCreate(guid) {
      if (!guid) {
        _ember["default"].assert('You have tried to findOrCreate without a guid');
      }
      return this.find(guid) || this.createPromise({ guid: guid });
    }
  });
});
define('ember-inspector/libs/resizable-columns', ['exports', 'ember', 'ember-inspector/utils/compare-arrays'], function (exports, _ember, _emberInspectorUtilsCompareArrays) {
  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  var set = _ember['default'].set;
  var isNone = _ember['default'].isNone;
  var copy = _ember['default'].copy;
  var merge = _ember['default'].merge;
  var floor = Math.floor;
  var keys = Object.keys;

  var THIRTY_DAYS_FROM_NOW = 1000 * 60 * 60 * 24 * 30;

  var _default = (function () {

    /**
     * Set up everything when new instance is created.
     *
     * @method constructor
     * @param {Object}
     *  - {String} key Used as key for local storage caching
     *  - {Number} tableWidth The table's width used for width calculations
     *  - {Number} minWidth The minimum width a column can reach
     *  - {Service} storage The local storage service that manages caching
     *  - {Array} columnSchema Contains the list of columns. Each column object should contain:
     *    - {String} id The column's unique identifier
     *    - {String} name The column's name
     *    - {Boolean} visible The column's default visibility
     */

    function _default(_ref) {
      var key = _ref.key;
      var _ref$tableWidth = _ref.tableWidth;
      var tableWidth = _ref$tableWidth === undefined ? 0 : _ref$tableWidth;
      var _ref$minWidth = _ref.minWidth;
      var minWidth = _ref$minWidth === undefined ? 10 : _ref$minWidth;
      var storage = _ref.storage;
      var columnSchema = _ref.columnSchema;

      _classCallCheck(this, _default);

      this.tableWidth = tableWidth;
      this.minWidth = minWidth;
      this.key = key;
      this.storage = storage;
      this.columnSchema = columnSchema;
      this.setupCache();
    }

    /**
     * This method is called on initialization before everything.
     *
     * Does 3 things:
     *   - Clears the cache if it's invalid.
     *   - Clears expired cache.
     *   - Sets the current cache timestamp to now.
     *
     * @method setupCache
     */

    _createClass(_default, [{
      key: 'setupCache',
      value: function setupCache() {
        this.clearInvalidCache();
        this.clearExpiredCache();
        this.setCacheTimestamp();
      }

      /**
       * Sets the current cache's `updatedAt` property to now.
       * This timestamp is used to later clear this cache when
       * it expires.
       *
       * @method setCacheTimestamp
       */
    }, {
      key: 'setCacheTimestamp',
      value: function setCacheTimestamp() {
        var saved = this.storage.getItem(this.getStorageKey()) || {};
        saved.updatedAt = Date.now();
        this.storage.setItem(this.getStorageKey(), saved);
      }

      /**
       * This makes sure that if a cache already exists, it matches
       * the current column schema. If it does not, clear the existing
       * cache.
       *
       * The reason this scenario may occur is for volatile schemas
       * (such as records in the Data Tab since they depend on the user's models),
       * or when a list's schema is modified in a later upgrade.
       *
       * @method clearInvalidCache
       */
    }, {
      key: 'clearInvalidCache',
      value: function clearInvalidCache() {
        var saved = this.storage.getItem(this.getStorageKey());
        if (saved && saved.columnVisibility) {
          var savedIds = keys(saved.columnVisibility).sort();
          var schemaIds = this.columnSchema.mapBy('id').sort();
          if (!(0, _emberInspectorUtilsCompareArrays['default'])(savedIds, schemaIds)) {
            // Clear saved items
            this.storage.removeItem(this.getStorageKey());
          }
        }
      }

      /**
       * Goes over all `x-list` caches and clears them if
       * they haven't been used for up to 30 days. This prevents
       * old caches from taking over local storage. This could happen
       * in the Data tab where schemas are dynamic and could no longer
       * be needed.
       *
       * @method clearExpiredCache
       */
    }, {
      key: 'clearExpiredCache',
      value: function clearExpiredCache() {
        var _this = this;

        var now = Date.now();
        this.storage.keys().filter(function (key) {
          return key.match(/^x-list/);
        }).forEach(function (key) {
          if (now - _this.storage.getItem(key).updatedAt > THIRTY_DAYS_FROM_NOW) {
            _this.storage.removeItem(key);
          }
        });
      }

      /**
       * Returns a specific column's width. This value could either
       * be calculated or retrieved from local storage cache.
       *
       * @method getColumnWidth
       * @param {String} id The column's id
       * @return {Number}   The column's width
       */
    }, {
      key: 'getColumnWidth',
      value: function getColumnWidth(id) {
        var total = this.tableWidth;
        var percentage = this.getSavedPercentage(id);
        if (isNone(percentage)) {
          percentage = 1 / this.columnSchema.length;
        }
        return floor(total * percentage);
      }

      /**
       * Used to update `tableWidth` property in case
       * the table's width changes.
       *
       * @method setTableWidth
       * @param {Number} tableWidth
       */
    }, {
      key: 'setTableWidth',
      value: function setTableWidth(tableWidth) {
        this.tableWidth = tableWidth;
        this.build();
      }

      /**
       * Call this to build the `columns` property.
       * All width calculations and cache retrievals happen
       * here.
       *
       * @method build
       */
    }, {
      key: 'build',
      value: function build() {
        this.buildColumns();
        this.processColumns();
      }

      /**
       * Indicates whether a specific column should be visible
       * or hidden. The value depends on cached values
       * and defaults to the original schema.
       *
       * @method isColumnVisible
       * @param {String} id
       * @return {Boolean}
       */
    }, {
      key: 'isColumnVisible',
      value: function isColumnVisible(id) {
        var saved = this.storage.getItem(this.getStorageKey()) || {};
        if (saved.columnVisibility && !isNone(saved.columnVisibility[id])) {
          return saved.columnVisibility[id];
        }
        return this.columnSchema.findBy('id', id).visible;
      }

      /**
       * Returns an array of column objects containing a
       * `visible` property which indicates whether they are visible
       * or not.
       *
       * @method getColumnVisibility
       * @return {Array}
       */
    }, {
      key: 'getColumnVisibility',
      value: function getColumnVisibility() {
        return this._columnVisibility;
      }

      /**
       * Builds an array of columns and sets their `visible` property to the
       * current column's visibility status. The array is stored in
       * `_columnVisibility` property which will be the true reference to
       * which columns are visible and which are not at the moment.
       *
       * @method buildColumnVisibility
       */
    }, {
      key: 'buildColumnVisibility',
      value: function buildColumnVisibility() {
        var _this2 = this;

        if (this._columnVisibility) {
          return this._columnVisibility;
        }
        this._columnVisibility = this.columnSchema.map(function (column) {
          return merge(copy(column), {
            visible: _this2.isColumnVisible(column.id)
          });
        });
      }

      /**
       * Builds the `_columns` array which is a list of all columns
       * along with their calculated/cached widths. Call this method
       * whenever you need to recalculate the columns' widths.
       *
       * @method buildColumns
       */
    }, {
      key: 'buildColumns',
      value: function buildColumns() {
        var _this3 = this;

        this.buildColumnVisibility();
        var totalWidth = 0;
        var columns = this._columnVisibility.filterBy('visible').map(function (_ref2) {
          var id = _ref2.id;
          var name = _ref2.name;

          var width = _this3.getColumnWidth(id);
          totalWidth += width;
          return { width: width, id: id, name: name };
        });
        // Fix percentage precision errors. If we only add it to the last column
        // the last column will slowly increase in size every time we visit this list.
        // So we distribute the extra pixels starting with the smallest column.
        if (columns.length > 0) {
          (function () {
            var diff = _this3.tableWidth - totalWidth;
            while (diff > 0) {
              columns.sortBy('width').forEach(function (column) {
                if (diff > 0) {
                  column.width++;
                  diff--;
                }
              });
            }
          })();
        }
        this._columns = columns;
      }

      /**
       * Method that updates a specific column's width.
       * One column's width change will affect the last column's
       * width. Calling this will result in an updated `columns`
       * array.
       *
       * @method updateColumnWidth
       * @param {String} id The column's id
       * @param {Number} width The column's new width
       */
    }, {
      key: 'updateColumnWidth',
      value: function updateColumnWidth(id, width) {
        var column = this._columns.findBy('id', id);
        var previousWidth = column.width;
        column.width = width;
        var last = this._columns[this._columns.length - 1];
        var lastColumnWidth = last.width + previousWidth - width;
        last.width = lastColumnWidth;
        this.processColumns();
      }

      /**
       * Method to toggle the visibility of a column. Mainly called
       * when a user toggles a column using the header's context menu.
       *
       * This method also resets width because adding/removing columns
       * will invalidate the current width distribution.
       *
       * @method toggleVisibility
       * @param {String} id
       */
    }, {
      key: 'toggleVisibility',
      value: function toggleVisibility(id) {
        var column = this._columnVisibility.findBy('id', id);
        column.visible = !column.visible;
        if (!this._columnVisibility.isAny('visible')) {
          // If this column was the last visible column
          // cancel toggling and set back to `true`.
          column.visible = true;
        }
        this.resetWidths();
      }

      /**
       * Calculates the columns' left positions and maximum width.
       * The maximum width of one column depends on the columns
       * positioned after that column.
       *
       * This method also saves all visibility and width settings.
       *
       * @method processColumns
       */
    }, {
      key: 'processColumns',
      value: function processColumns() {
        var _this4 = this;

        var columns = this._columns;
        var prevLeft = undefined,
            prevWidth = undefined;
        columns = columns.map(function (_ref3, index) {
          var id = _ref3.id;
          var name = _ref3.name;
          var visible = _ref3.visible;
          var width = _ref3.width;

          var last = _this4._columns[_this4._columns.length - 1];
          var left = 0;
          if (index > 0) {
            left = prevWidth + prevLeft;
          }
          var maxWidth = width + last.width - _this4.minWidth;
          prevLeft = left;
          prevWidth = width;
          return { id: id, name: name, width: width, left: left, maxWidth: maxWidth };
        });
        this.saveVisibility();
        this.saveWidths();
        set(this, 'columns', columns);
      }

      /**
       * Caches which columns are visible and which ones are hidden.
       * Uses local storage. Visibility settings will remain unchanged
       * whenever the inspector is used another time.
       *
       * @method saveVisibility
       */
    }, {
      key: 'saveVisibility',
      value: function saveVisibility() {
        var saved = this.storage.getItem(this.getStorageKey()) || {};
        saved.columnVisibility = this._columnVisibility.reduce(function (obj, _ref4) {
          var id = _ref4.id;
          var visible = _ref4.visible;

          obj[id] = visible;
          return obj;
        }, {});
        this.storage.setItem(this.getStorageKey(), saved);
      }

      /**
       * Resets the current column widths by clearing the cache and
       * recalculating them from scratch.
       *
       * @method resetWidths
       */
    }, {
      key: 'resetWidths',
      value: function resetWidths() {
        var saved = this.storage.getItem(this.getStorageKey()) || {};
        delete saved.columnWidths;
        this.storage.setItem(this.getStorageKey(), saved);
        this.build();
      }

      /**
       * Uses local storage to cache the current column widths. A specific
       * table's widths will remaing unchanged anyime the inspector is opened again.
       *
       * The stored widths are percentages so that they remain independent of a table's
       * width.
       *
       * @method saveWidths
       */
    }, {
      key: 'saveWidths',
      value: function saveWidths() {
        var columns = {};
        var totalWidth = this._columns.reduce(function (sum, _ref5) {
          var width = _ref5.width;
          return sum + width;
        }, 0);
        this._columns.forEach(function (_ref6) {
          var id = _ref6.id;
          var width = _ref6.width;

          columns[id] = width / totalWidth;
        });
        var saved = this.storage.getItem(this.getStorageKey()) || {};
        saved.columnWidths = columns;
        this.storage.setItem(this.getStorageKey(), saved);
      }

      /**
       * The storage key to use for local storage.
       * Depends on the `key` property.
       *
       * @method getStorageKey
       */
    }, {
      key: 'getStorageKey',
      value: function getStorageKey() {
        return 'x-list__' + this.key;
      }

      /**
       * Returns the cached width of a column.
       *
       * @method getSavedPercentage
       * @param  {String} id The column's id
       * @return {Number}    The cached percentage
       */
    }, {
      key: 'getSavedPercentage',
      value: function getSavedPercentage(id) {
        var saved = this.storage.getItem(this.getStorageKey()) || {};
        return saved.columnWidths && saved.columnWidths[id];
      }
    }]);

    return _default;
  })();

  exports['default'] = _default;
});
/**
 * Class responsible for calculating column widths and visibility.
 * Used by the `x-list` component to manage its columns.
 *
 * Uses local storage to cache a user's preferred settings.
 */
define('ember-inspector/mixins/in-viewport', ['exports', 'smoke-and-mirrors/mixins/in-viewport'], function (exports, _smokeAndMirrorsMixinsInViewport) {
  exports['default'] = _smokeAndMirrorsMixinsInViewport['default'];
});
define('ember-inspector/mixins/row-events', ['exports', 'ember'], function (exports, _ember) {
  var Mixin = _ember['default'].Mixin;
  var assert = _ember['default'].assert;
  var isNone = _ember['default'].isNone;
  var readOnly = _ember['default'].computed.readOnly;
  exports['default'] = Mixin.create({
    /**
     * The current component's index. Pass this through the
     * template so the mixin can figure out which row this component
     * belongs to.
     *
     * @property index
     * @default null
     */
    index: null,

    /**
     * Action to trigger when a row is clicked.
     *
     * @property on-click
     * @type {Function}
     */
    'on-click': function onClick() {},

    /**
     * Action to trigger when a row mouseenter event is triggered.
     *
     * @property on-mouseenter
     * @type {Function}
     */
    'on-mouseenter': function onMouseenter() {},

    /**
     * Action to trigger when a row mouseleave event is triggered.
     *
     * @property on-mouseleave
     * @type {Function}
     */
    'on-mouseleave': function onMouseleave() {},

    /**
     * An alias to the list's `rowEvents` property.
     * The component must have a `list` property containing
     * the yielded `x-list`.
     *
     * @property rowEvents
     * @type {Ember.Object}
     */
    rowEvents: readOnly('list.rowEvents'),

    /**
     * Hook called on element insert. Sets up event listeners.
     *
     * @method didInsertElement
     */
    didInsertElement: function didInsertElement() {
      assert('You must pass `list` to a component that listens to row-events', !!this.get('list'));
      assert('You must pass `index` to a component that listens to row-events', !isNone(this.get('index')));

      this.get('rowEvents').on('click', this, 'handleEvent');
      this.get('rowEvents').on('mouseleave', this, 'handleEvent');
      this.get('rowEvents').on('mouseenter', this, 'handleEvent');
      return this._super.apply(this, arguments);
    },

    /**
     * Hook called before destroying the element.
     * Cleans up event listeners.
     *
     * @method willDestroyElement
     */
    willDestroyElement: function willDestroyElement() {
      this.get('rowEvents').off('click', this, 'handleEvent');
      this.get('rowEvents').off('mouseleave', this, 'handleEvent');
      this.get('rowEvents').off('mouseenter', this, 'handleEvent');
      return this._super.apply(this, arguments);
    },

    /**
     * Makes sure the event triggered matches the current
     * component's index.
     *
     * @method handleEvent
     * @param {Object}
     *  - {Number} index The current row index
     *  - {String} type Event type
     */
    handleEvent: function handleEvent(_ref) {
      var index = _ref.index;
      var type = _ref.type;

      if (index === this.get('index')) {
        if (this.get('on-' + type)) {
          this.get('on-' + type)();
        }
      }
    }
  });
});
/**
 * Mixin to work-around the fact that we can't listen to row events
 * when using smoke-and-mirrors and tables.
 *
 * Add this to a tagless component inside a vertical-collection row and pass
 * the yielded `x-list` and index to it. Then you'll be able to listen
 * to events on `rowEvents`.
 */
define("ember-inspector/models/promise", ["exports", "ember", "ember-inspector/utils/escape-reg-exp", "ember-new-computed"], function (exports, _ember, _emberInspectorUtilsEscapeRegExp, _emberNewComputed) {
  var $ = _ember["default"].$;
  var observer = _ember["default"].observer;
  var typeOf = _ember["default"].typeOf;
  var _Ember$computed = _ember["default"].computed;
  var or = _Ember$computed.or;
  var equal = _Ember$computed.equal;
  var not = _Ember$computed.not;

  var dateComputed = function dateComputed() {
    return (0, _emberNewComputed["default"])({
      get: function get() {
        return null;
      },
      set: function set(key, date) {
        if (typeOf(date) === 'date') {
          return date;
        } else if (typeof date === 'number' || typeof date === 'string') {
          return new Date(date);
        }
        return null;
      }
    });
  };

  exports["default"] = _ember["default"].Object.extend({
    createdAt: dateComputed(),
    settledAt: dateComputed(),

    parent: null,

    level: (0, _emberNewComputed["default"])('parent.level', function () {
      var parent = this.get('parent');
      if (!parent) {
        return 0;
      }
      return parent.get('level') + 1;
    }),

    isSettled: or('isFulfilled', 'isRejected'),

    isFulfilled: equal('state', 'fulfilled'),

    isRejected: equal('state', 'rejected'),

    isPending: not('isSettled'),

    children: (0, _emberNewComputed["default"])(function () {
      return [];
    }),

    pendingBranch: (0, _emberNewComputed["default"])('isPending', 'children.@each.pendingBranch', function () {
      return this.recursiveState('isPending', 'pendingBranch');
    }),

    rejectedBranch: (0, _emberNewComputed["default"])('isRejected', 'children.@each.rejectedBranch', function () {
      return this.recursiveState('isRejected', 'rejectedBranch');
    }),

    fulfilledBranch: (0, _emberNewComputed["default"])('isFulfilled', 'children.@each.fulfilledBranch', function () {
      return this.recursiveState('isFulfilled', 'fulfilledBranch');
    }),

    recursiveState: function recursiveState(prop, cp) {
      if (this.get(prop)) {
        return true;
      }
      for (var i = 0; i < this.get('children.length'); i++) {
        if (this.get('children').objectAt(i).get(cp)) {
          return true;
        }
      }
      return false;
    },

    // Need this observer because CP dependent keys do not support nested arrays
    // TODO: This can be so much better
    stateChanged: observer('pendingBranch', 'fulfilledBranch', 'rejectedBranch', function () {
      if (!this.get('parent')) {
        return;
      }
      if (this.get('pendingBranch') && !this.get('parent.pendingBranch')) {
        this.get('parent').notifyPropertyChange('fulfilledBranch');
        this.get('parent').notifyPropertyChange('rejectedBranch');
        this.get('parent').notifyPropertyChange('pendingBranch');
      } else if (this.get('fulfilledBranch') && !this.get('parent.fulfilledBranch')) {
        this.get('parent').notifyPropertyChange('fulfilledBranch');
        this.get('parent').notifyPropertyChange('rejectedBranch');
        this.get('parent').notifyPropertyChange('pendingBranch');
      } else if (this.get('rejectedBranch') && !this.get('parent.rejectedBranch')) {
        this.get('parent').notifyPropertyChange('fulfilledBranch');
        this.get('parent').notifyPropertyChange('rejectedBranch');
        this.get('parent').notifyPropertyChange('pendingBranch');
      }
    }),

    updateParentLabel: observer('label', 'parent', function () {
      this.addBranchLabel(this.get('label'), true);
    }),

    addBranchLabel: function addBranchLabel(label, replace) {
      if (_ember["default"].isEmpty(label)) {
        return;
      }
      if (replace) {
        this.set('branchLabel', label);
      } else {
        this.set('branchLabel', this.get('branchLabel') + " " + label);
      }

      var parent = this.get('parent');
      if (parent) {
        parent.addBranchLabel(label);
      }
    },

    branchLabel: '',

    matches: function matches(val) {
      return !!this.get('branchLabel').toLowerCase().match(new RegExp(".*" + (0, _emberInspectorUtilsEscapeRegExp["default"])(val.toLowerCase()) + ".*"));
    },

    matchesExactly: function matchesExactly(val) {
      return !!(this.get('label') || '').toLowerCase().match(new RegExp(".*" + (0, _emberInspectorUtilsEscapeRegExp["default"])(val.toLowerCase()) + ".*"));
    },

    // EXPANDED / COLLAPSED PROMISES

    isExpanded: false,

    isManuallyExpanded: undefined,

    stateOrParentChanged: observer('isPending', 'isFulfilled', 'isRejected', 'parent', function () {
      var parent = this.get('parent');
      if (parent) {
        _ember["default"].run.once(parent, 'recalculateExpanded');
      }
    }),

    _findTopParent: function _findTopParent() {
      var parent = this.get('parent');
      if (!parent) {
        return this;
      } else {
        return parent._findTopParent();
      }
    },

    recalculateExpanded: function recalculateExpanded() {
      var isExpanded = false;
      if (this.get('isManuallyExpanded') !== undefined) {
        isExpanded = this.get('isManuallyExpanded');
      } else {
        var children = this._allChildren();
        for (var i = 0, l = children.length; i < l; i++) {
          var child = children[i];
          if (child.get('isRejected')) {
            isExpanded = true;
          }
          if (child.get('isPending') && !child.get('parent.isPending')) {
            isExpanded = true;
          }
          if (isExpanded) {
            break;
          }
        }
        var parents = this._allParents();
        if (isExpanded) {
          parents.forEach(function (parent) {
            parent.set('isExpanded', true);
          });
        } else if (this.get('parent.isExpanded')) {
          this.get('parent').recalculateExpanded();
        }
      }
      this.set('isExpanded', isExpanded);
      return isExpanded;
    },

    isVisible: (0, _emberNewComputed["default"])('parent.isExpanded', 'parent', 'parent.isVisible', function () {
      if (this.get('parent')) {
        return this.get('parent.isExpanded') && this.get('parent.isVisible');
      }
      return true;
    }),

    _allChildren: function _allChildren() {
      var children = $.extend([], this.get('children'));
      children.forEach(function (item) {
        children = $.merge(children, item._allChildren());
      });
      return children;
    },

    _allParents: function _allParents() {
      var parent = this.get('parent');
      if (parent) {
        return $.merge([parent], parent._allParents());
      } else {
        return [];
      }
    }
  });
});
define('ember-inspector/port', ['exports', 'ember'], function (exports, _ember) {
  var computed = _ember['default'].computed;
  exports['default'] = _ember['default'].Object.extend(_ember['default'].Evented, {
    applicationId: undefined,

    detectedApplications: computed(function () {
      return [];
    }),

    init: function init() {
      var _this = this;

      var detectedApplications = this.get('detectedApplications');
      this.get('adapter').onMessageReceived(function (message) {
        if (!message.applicationId) {
          return;
        }
        if (!_this.get('applicationId')) {
          _this.set('applicationId', message.applicationId);
        }
        // save list of application ids
        if (detectedApplications.indexOf(message.applicationId) === -1) {
          detectedApplications.pushObject(message.applicationId);
        }

        var applicationId = _this.get('applicationId');
        if (applicationId === message.applicationId) {
          _this.trigger(message.type, message, applicationId);
        }
      });
    },
    send: function send(type, message) {
      message = message || {};
      message.type = type;
      message.from = 'devtools';
      message.applicationId = this.get('applicationId');
      this.get('adapter').sendMessage(message);
    }
  });
});
define('ember-inspector/resolver', ['exports', 'ember-resolver'], function (exports, _emberResolver) {
  exports['default'] = _emberResolver['default'];
});
define('ember-inspector/router', ['exports', 'ember', 'ember-inspector/config/environment'], function (exports, _ember, _emberInspectorConfigEnvironment) {

  var Router = _ember['default'].Router.extend({
    location: _emberInspectorConfigEnvironment['default'].locationType
  });

  Router.map(function () {
    this.route('app-detected', { path: '/', resetNamespace: true }, function () {
      this.route('view-tree', { path: '/', resetNamespace: true });
      this.route('route-tree', { resetNamespace: true });

      this.route('data', { resetNamespace: true }, function () {
        this.route('model-types', { resetNamespace: true }, function () {
          this.route('model-type', { path: '/:type_id', resetNamespace: true }, function () {
            this.route('records', { resetNamespace: true });
          });
        });
      });

      this.route('promise-tree', { resetNamespace: true });

      this.route('info', { resetNamespace: true });
      this.route('render-tree', { resetNamespace: true });
      this.route('container-types', { resetNamespace: true }, function () {
        this.route('container-type', { path: '/:type_id', resetNamespace: true });
      });

      this.route('deprecations', { resetNamespace: true });
    });
  });

  exports['default'] = Router;
});
define('ember-inspector/routes/app-detected', ['exports', 'ember'], function (exports, _ember) {
  var Route = _ember['default'].Route;
  var Promise = _ember['default'].RSVP.Promise;
  var getOwner = _ember['default'].getOwner;
  exports['default'] = Route.extend({
    model: function model() {
      var _this = this;

      var port = this.get('port');
      return new Promise(function (resolve) {
        port.on('general:applicationBooted', _this, function (message) {
          if (message.booted) {
            port.off('general:applicationBooted');
            resolve();
          }
        });
        port.send('general:applicationBooted');
      });
    },

    setupController: function setupController() {
      this.controllerFor('application').set('emberApplication', true);
      this.get('port').one('general:reset', this, this.reset);
    },

    reset: function reset() {
      getOwner(this).lookup('application:main').reset();
    },

    deactivate: function deactivate() {
      this.get('port').off('general:applicationBooted');
      this.get('port').off('general:reset', this, this.reset);
    }
  });
});
define('ember-inspector/routes/application', ['exports', 'ember'], function (exports, _ember) {
  var Route = _ember['default'].Route;
  var inject = _ember['default'].inject;
  var run = _ember['default'].run;
  var NativeArray = _ember['default'].NativeArray;
  var service = inject.service;
  var schedule = run.schedule;

  var set = _ember['default'].set;
  var get = _ember['default'].get;

  exports['default'] = Route.extend({

    setupController: function setupController(controller) {
      controller.set('mixinStack', []);
      var port = this.get('port');
      port.on('objectInspector:updateObject', this, this.updateObject);
      port.on('objectInspector:updateProperty', this, this.updateProperty);
      port.on('objectInspector:updateErrors', this, this.updateErrors);
      port.on('objectInspector:droppedObject', this, this.droppedObject);
      port.on('deprecation:count', this, this.setDeprecationCount);
      port.send('deprecation:getCount');
    },

    deactivate: function deactivate() {
      var port = this.get('port');
      port.off('objectInspector:updateObject', this, this.updateObject);
      port.off('objectInspector:updateProperty', this, this.updateProperty);
      port.off('objectInspector:updateErrors', this, this.updateErrors);
      port.off('objectInspector:droppedObject', this, this.droppedObject);
      port.off('deprecation:count', this, this.setDeprecationCount);
    },

    updateObject: function updateObject(options) {
      var details = options.details,
          name = options.name,
          property = options.property,
          objectId = options.objectId,
          errors = options.errors;

      NativeArray.apply(details);
      details.forEach(arrayize);

      var controller = this.get('controller');

      if (options.parentObject) {
        controller.pushMixinDetails(name, property, objectId, details);
      } else {
        controller.activateMixinDetails(name, objectId, details, errors);
      }

      this.send('expandInspector');
    },

    setDeprecationCount: function setDeprecationCount(message) {
      this.controller.set('deprecationCount', message.count);
    },

    updateProperty: function updateProperty(options) {
      var detail = this.get('controller.mixinDetails.mixins').objectAt(options.mixinIndex);
      var property = get(detail, 'properties').findBy('name', options.property);
      set(property, 'value', options.value);
    },

    updateErrors: function updateErrors(options) {
      var mixinDetails = this.get('controller.mixinDetails');
      if (mixinDetails) {
        if (get(mixinDetails, 'objectId') === options.objectId) {
          set(mixinDetails, 'errors', options.errors);
        }
      }
    },

    droppedObject: function droppedObject(message) {
      this.get('controller').droppedObject(message.objectId);
    },

    /**
     * Service used to broadcast changes to the application's layout
     * such as toggling of the object inspector.
     *
     * @property layout
     * @type {Service}
     */
    layout: service(),

    actions: {
      expandInspector: function expandInspector() {
        var _this = this;

        this.set("controller.inspectorExpanded", true);
        // Broadcast that tables have been resized (used by `x-list`).
        schedule('afterRender', function () {
          _this.get('layout').trigger('resize', { source: 'object-inspector' });
        });
      },
      toggleInspector: function toggleInspector() {
        var _this2 = this;

        this.toggleProperty("controller.inspectorExpanded");
        // Broadcast that tables have been resized (used by `x-list`).
        schedule('afterRender', function () {
          _this2.get('layout').trigger('resize', { source: 'object-inspector' });
        });
      },
      inspectObject: function inspectObject(objectId) {
        if (objectId) {
          this.get('port').send('objectInspector:inspectById', { objectId: objectId });
        }
      },
      setIsDragging: function setIsDragging(isDragging) {
        this.set('controller.isDragging', isDragging);
      },
      refreshPage: function refreshPage() {
        // If the adapter defined a `reloadTab` method, it means
        // they prefer to handle the reload themselves
        if (typeof this.get('adapter').reloadTab === 'function') {
          this.get('adapter').reloadTab();
        } else {
          // inject ember_debug as quickly as possible in chrome
          // so that promises created on dom ready are caught
          this.get('port').send('general:refresh');
          this.get('adapter').willReload();
        }
      }
    }
  });

  function arrayize(mixin) {
    NativeArray.apply(mixin.properties);
  }
});
define("ember-inspector/routes/container-type", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var get = _ember["default"].get;
  var Promise = _ember["default"].RSVP.Promise;
  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    setupController: function setupController(controller) {
      controller.setProperties({
        search: '',
        searchVal: ''
      });
      this._super.apply(this, arguments);
    },
    model: function model(params) {
      var type = params.type_id;
      var port = this.get('port');
      return new Promise(function (resolve, reject) {
        port.one('container:instances', function (message) {
          if (message.status === 200) {
            resolve(message.instances);
          } else {
            reject(message);
          }
        });
        port.send('container:getInstances', { containerType: type });
      });
    },

    actions: {
      error: function error(err) {
        if (err && err.status === 404) {
          this.transitionTo('container-types.index');
          return false;
        }
      },
      sendInstanceToConsole: function sendInstanceToConsole(obj) {
        this.get('port').send('container:sendInstanceToConsole', { name: get(obj, 'fullName') });
      }
    }
  });
});
define('ember-inspector/routes/container-types', ['exports', 'ember'], function (exports, _ember) {
  var Route = _ember['default'].Route;
  var Promise = _ember['default'].RSVP.Promise;
  exports['default'] = Route.extend({
    model: function model() {
      var port = this.get('port');
      return new Promise(function (resolve) {
        port.one('container:types', function (message) {
          resolve(message.types);
        });
        port.send('container:getTypes');
      });
    },
    actions: {
      reload: function reload() {
        this.refresh();
      }
    }
  });
});
define("ember-inspector/routes/container-types/index", ["exports", "ember-inspector/routes/tab"], function (exports, _emberInspectorRoutesTab) {
  exports["default"] = _emberInspectorRoutesTab["default"];
});
define('ember-inspector/routes/data/index', ['exports', 'ember'], function (exports, _ember) {
  var Promise = _ember['default'].RSVP.Promise;
  exports['default'] = _ember['default'].Route.extend({
    model: function model() {
      var route = this;
      return new Promise(function (resolve) {
        route.get('port').one('data:hasAdapter', function (message) {
          resolve(message.hasAdapter);
        });
        route.get('port').send('data:checkAdapter');
      });
    },
    afterModel: function afterModel(model) {
      if (model) {
        this.transitionTo('model-types');
      }
    }
  });
});
define("ember-inspector/routes/deprecations", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var set = _ember["default"].set;

  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    setupController: function setupController() {
      var port = this.get('port');
      port.on('deprecation:deprecationsAdded', this, this.deprecationsAdded);
      port.send('deprecation:watch');
      this._super.apply(this, arguments);
    },

    model: function model() {
      return [];
    },

    deactivate: function deactivate() {
      this.get('port').off('deprecation:deprecationsAdded', this, this.deprecationsAdded);
    },

    deprecationsAdded: function deprecationsAdded(message) {
      var model = this.get('currentModel');
      message.deprecations.forEach(function (item) {
        var record = model.findBy('id', item.id);
        if (record) {
          set(record, 'count', item.count);
          set(record, 'sources', item.sources);
          set(record, 'url', item.url);
        } else {
          model.pushObject(item);
        }
      });
    },

    actions: {
      clear: function clear() {
        this.get('port').send('deprecation:clear');
        this.get('currentModel').clear();
      }

    }
  });
});
define("ember-inspector/routes/info", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var Promise = _ember["default"].RSVP.Promise;
  var computed = _ember["default"].computed;
  var oneWay = computed.oneWay;
  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    version: oneWay('config.VERSION').readOnly(),

    model: function model() {
      var version = this.get('version');
      var port = this.get('port');
      return new Promise(function (resolve) {
        port.one('general:libraries', function (message) {
          message.libraries.insertAt(0, {
            name: 'Ember Inspector',
            version: version
          });
          resolve(message.libraries);
        });
        port.send('general:getLibraries');
      });
    }
  });
});
define('ember-inspector/routes/model-type', ['exports', 'ember'], function (exports, _ember) {
  var Promise = _ember['default'].RSVP.Promise;

  /*eslint camelcase: 0 */
  exports['default'] = _ember['default'].Route.extend({
    setupController: function setupController(controller, model) {
      this._super(controller, model);
      this.controllerFor('model-types').set('selected', model);
    },

    model: function model(params) {
      var _this = this;

      return new Promise(function (resolve) {
        var type = _this.modelFor('model-types').findBy('name', decodeURIComponent(params.type_id));
        if (type) {
          resolve(type);
        } else {
          _this.transitionTo('model-types.index');
        }
      });
    },

    deactivate: function deactivate() {
      this.controllerFor('model-types').set('selected', null);
    },

    serialize: function serialize(model) {
      return { type_id: _ember['default'].get(model, 'name') };
    }
  });
});
define("ember-inspector/routes/model-types", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var Promise = _ember["default"].RSVP.Promise;
  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    setupController: function setupController(controller, model) {
      this._super(controller, model);
      this.get('port').on('data:modelTypesAdded', this, this.addModelTypes);
      this.get('port').on('data:modelTypesUpdated', this, this.updateModelTypes);
    },

    model: function model() {
      var port = this.get('port');
      return new Promise(function (resolve) {
        port.one('data:modelTypesAdded', this, function (message) {
          resolve(message.modelTypes);
        });
        port.send('data:getModelTypes');
      });
    },

    deactivate: function deactivate() {
      this.get('port').off('data:modelTypesAdded', this, this.addModelTypes);
      this.get('port').off('data:modelTypesUpdated', this, this.updateModelTypes);
      this.get('port').send('data:releaseModelTypes');
    },

    addModelTypes: function addModelTypes(message) {
      this.get('currentModel').pushObjects(message.modelTypes);
    },

    updateModelTypes: function updateModelTypes(message) {
      var route = this;
      message.modelTypes.forEach(function (modelType) {
        var currentType = route.get('currentModel').findBy('objectId', modelType.objectId);
        _ember["default"].set(currentType, 'count', modelType.count);
      });
    }
  });
});
define("ember-inspector/routes/promise-tree", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var Promise = _ember["default"].RSVP.Promise;
  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    model: function model() {
      var _this = this;

      // block rendering until first batch arrives
      // Helps prevent flashing of "please refresh the page"
      return new Promise(function (resolve) {
        _this.get('assembler').one('firstMessageReceived', function () {
          resolve(_this.get('assembler.topSort'));
        });
        _this.get('assembler').start();
      });
    },

    setupController: function setupController() {
      this._super.apply(this, arguments);
      this.get('port').on('promise:instrumentWithStack', this, this.setInstrumentWithStack);
      this.get('port').send('promise:getInstrumentWithStack');
    },

    setInstrumentWithStack: function setInstrumentWithStack(message) {
      this.set('controller.instrumentWithStack', message.instrumentWithStack);
    },

    deactivate: function deactivate() {
      this.get('assembler').stop();
      this.get('port').off('promse:getInstrumentWithStack', this, this.setInstrumentWithStack);
    }
  });
});
define("ember-inspector/routes/records", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {

  var set = _ember["default"].set;

  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    setupController: function setupController(controller, model) {
      this._super(controller, model);

      var type = this.modelFor('model_type');

      controller.set('modelType', type);

      this.get('port').on('data:recordsAdded', this, this.addRecords);
      this.get('port').on('data:recordsUpdated', this, this.updateRecords);
      this.get('port').on('data:recordsRemoved', this, this.removeRecords);
      this.get('port').one('data:filters', this, function (message) {
        this.set('controller.filters', message.filters);
      });
      this.get('port').send('data:getFilters');
      this.get('port').send('data:getRecords', { objectId: type.objectId });
    },

    model: function model() {
      return [];
    },

    deactivate: function deactivate() {
      this.get('port').off('data:recordsAdded', this, this.addRecords);
      this.get('port').off('data:recordsUpdated', this, this.updateRecords);
      this.get('port').off('data:recordsRemoved', this, this.removeRecords);
      this.get('port').send('data:releaseRecords');
    },

    updateRecords: function updateRecords(message) {
      var _this = this;

      message.records.forEach(function (record) {
        var currentRecord = _this.get('currentModel').findBy('objectId', record.objectId);
        if (currentRecord) {
          set(currentRecord, 'columnValues', record.columnValues);
          set(currentRecord, 'filterValues', record.filterValues);
          set(currentRecord, 'searchIndex', record.searchIndex);
          set(currentRecord, 'color', record.color);
        }
      });
    },

    addRecords: function addRecords(message) {
      this.get('currentModel').pushObjects(message.records);
    },

    removeRecords: function removeRecords(message) {
      this.get('currentModel').removeAt(message.index, message.count);
    }
  });
});
define("ember-inspector/routes/render-tree", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var Promise = _ember["default"].RSVP.Promise;
  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    model: function model() {
      var port = this.get('port');
      return new Promise(function (resolve) {
        port.one('render:profilesAdded', function (message) {
          resolve(message.profiles);
        });
        port.send('render:watchProfiles');
      });
    },

    setupController: function setupController(controller, model) {
      this._super.apply(this, arguments);
      if (model.length === 0) {
        controller.set('initialEmpty', true);
      }
      var port = this.get('port');
      port.on('render:profilesUpdated', this, this.profilesUpdated);
      port.on('render:profilesAdded', this, this.profilesAdded);
    },

    deactivate: function deactivate() {
      var port = this.get('port');
      port.off('render:profilesUpdated', this, this.profilesUpdated);
      port.off('render:profilesAdded', this, this.profilesAdded);
      port.send('render:releaseProfiles');
    },

    profilesUpdated: function profilesUpdated(message) {
      this.set('controller.model', message.profiles);
    },

    profilesAdded: function profilesAdded(message) {
      var model = this.get('controller.model');
      var profiles = message.profiles;

      model.pushObjects(profiles);
    },

    actions: {
      clearProfiles: function clearProfiles() {
        this.get('port').send('render:clear');
      }
    }

  });
});
define("ember-inspector/routes/route-tree", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var $ = _ember["default"].$;

  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    setupController: function setupController() {
      this.get('port').on('route:currentRoute', this, this.setCurrentRoute);
      this.get('port').send('route:getCurrentRoute');
      this.get('port').on('route:routeTree', this, this.setTree);
      this.get('port').send('route:getTree');
    },

    deactivate: function deactivate() {
      this.get('port').off('route:currentRoute');
      this.get('port').off('route:routeTree', this, this.setTree);
    },

    setCurrentRoute: function setCurrentRoute(message) {
      this.get('controller').set('currentRoute', message.name);
    },

    setTree: function setTree(options) {
      var routeArray = topSort(options.tree);
      this.set('controller.model', routeArray);
    }
  });

  function topSort(tree, list) {
    list = list || [];
    var route = $.extend({}, tree);
    delete route.children;
    // Firt node in the tree doesn't have a value
    if (route.value) {
      route.parentCount = route.parentCount || 0;
      list.push(route);
    }
    tree.children = tree.children || [];
    tree.children.forEach(function (child) {
      child.parentCount = route.parentCount + 1;
      topSort(child, list);
    });
    return list;
  }
});
define('ember-inspector/routes/tab', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({
    renderTemplate: function renderTemplate() {
      this.render();
      try {
        this.render(this.get('routeName').replace(/\./g, '/') + '-toolbar', {
          into: 'application',
          outlet: 'toolbar'
        });
      } catch (e) {}
    }
  });
});
/* eslint no-empty:0 */
define("ember-inspector/routes/view-tree", ["exports", "ember", "ember-inspector/routes/tab"], function (exports, _ember, _emberInspectorRoutesTab) {
  var $ = _ember["default"].$;

  exports["default"] = _emberInspectorRoutesTab["default"].extend({
    model: function model() {
      return [];
    },

    setupController: function setupController() {
      this._super.apply(this, arguments);
      this.get('port').on('view:viewTree', this, this.setViewTree);
      this.get('port').on('view:stopInspecting', this, this.stopInspecting);
      this.get('port').on('view:startInspecting', this, this.startInspecting);
      this.get('port').on('view:inspectDOMElement', this, this.inspectDOMElement);
      this.get('port').send('view:getTree');
    },

    deactivate: function deactivate() {
      this.get('port').off('view:viewTree', this, this.setViewTree);
      this.get('port').off('view:stopInspecting', this, this.stopInspecting);
      this.get('port').off('view:startInspecting', this, this.startInspecting);
      this.get('port').off('view:inspectDOMElement', this, this.inspectDOMElement);
    },

    setViewTree: function setViewTree(options) {
      var viewArray = topSort(options.tree);
      this.set('controller.model', viewArray);
    },

    startInspecting: function startInspecting() {
      this.set('controller.inspectingViews', true);
    },

    stopInspecting: function stopInspecting() {
      this.set('controller.inspectingViews', false);
    },

    inspectDOMElement: function inspectDOMElement(_ref) {
      var elementSelector = _ref.elementSelector;

      this.get('port.adapter').inspectDOMElement(elementSelector);
    }
  });

  function topSort(tree, list) {
    list = list || [];
    var view = $.extend({}, tree);
    view.parentCount = view.parentCount || 0;
    delete view.children;
    list.push(view);
    tree.children.forEach(function (child) {
      child.parentCount = view.parentCount + 1;
      topSort(child, list);
    });
    return list;
  }
});
define('ember-inspector/schemas/info-list', ['exports'], function (exports) {
  /**
   * Info list schema.
   */
  exports['default'] = {
    columns: [{
      id: 'library',
      name: 'Library',
      visible: true
    }, {
      id: 'version',
      name: 'Version',
      visible: true
    }]
  };
});
define('ember-inspector/schemas/promise-tree', ['exports'], function (exports) {
  /**
   * Promise tree schema.
   */
  exports['default'] = {
    columns: [{
      id: 'label',
      name: 'Label',
      visible: true
    }, {
      id: 'state',
      name: 'State',
      visible: true
    }, {
      id: 'settled-value',
      name: 'Fulfillment / Rejection value',
      visible: true
    }, {
      id: 'time',
      name: 'Time to settle',
      visible: true
    }]
  };
});
define('ember-inspector/schemas/render-tree', ['exports'], function (exports) {
  /**
   * Render tree schema.
   */
  exports['default'] = {
    columns: [{
      id: 'name',
      name: 'Name',
      visible: true
    }, {
      id: 'timestamp',
      name: 'Timestamp',
      visible: true,
      numeric: true
    }]
  };
});
define('ember-inspector/schemas/route-tree', ['exports'], function (exports) {
  /**
   * Route tree schema.
   */
  exports['default'] = {
    columns: [{
      id: 'name',
      name: 'Route Name',
      visible: true
    }, {
      id: 'route',
      name: 'Route',
      visible: true
    }, {
      id: 'controller',
      name: 'Controller',
      visible: true
    }, {
      id: 'template',
      name: 'Template',
      visible: true
    }, {
      id: 'url',
      name: 'URL',
      visible: true
    }]
  };
});
define('ember-inspector/schemas/view-tree', ['exports'], function (exports) {
  /**
   * View tree schema.
   */
  exports['default'] = {
    columns: [{
      id: 'name',
      name: 'Name',
      visible: true
    }, {
      id: 'template',
      name: 'Template',
      visible: true
    }, {
      id: 'model',
      name: 'Model',
      visible: true
    }, {
      id: 'controller',
      name: 'Controller',
      visible: true
    }, {
      id: 'component',
      name: 'View / Component',
      visible: true
    }, {
      id: 'duration',
      name: 'Duration',
      visible: true
    }]
  };
});
define('ember-inspector/services/in-viewport', ['exports', 'smoke-and-mirrors/services/in-viewport'], function (exports, _smokeAndMirrorsServicesInViewport) {
  exports['default'] = _smokeAndMirrorsServicesInViewport['default'];
});
define('ember-inspector/services/layout', ['exports', 'ember'], function (exports, _ember) {
  var Service = _ember['default'].Service;
  var Evented = _ember['default'].Evented;
  exports['default'] = Service.extend(Evented, {
    /**
     * Stores the app's content height. This property is kept up-to-date
     * by the `main-content` component.
     *
     * @property contentHeight
     * @type {Number}
     */
    contentHeight: null,

    /**
     * This is called by `main-content` whenever a window resize is detected
     * and the app's content height has changed. We therefore update the
     * `contentHeight` property and notify all listeners (mostly lists).
     *
     * @method updateContentHeight
     * @param  {Number} height The new app content height
     */
    updateContentHeight: function updateContentHeight(height) {
      this.set('contentHeight', height);
      this.trigger('content-height-update', height);
    }
  });
});
/**
 * Layout service used to broadcast changes to the application's
 * layout due to resizing of the main nav or the object inspector toggling.
 *
 * Whenever something resizes it triggers an event on this service. For example
 * when the main nav is resized.
 * Elements dependant on the app's layout listen to events on this service. For
 * example the `x-list` component.
 *
 * @class Layout
 * @extends Service
 */
define('ember-inspector/services/storage/local', ['exports', 'ember'], function (exports, _ember) {
  var Service = _ember['default'].Service;
  var isNone = _ember['default'].isNone;
  var parse = JSON.parse;
  var stringify = JSON.stringify;
  exports['default'] = Service.extend({
    /**
     * Reads a stored json string and parses it to
     * and object.
     *
     * @method getItem
     * @param  {String} key The cache key
     * @return {Object}     The json value
     */
    getItem: function getItem(key) {
      var json = localStorage.getItem(key);
      return json && parse(json);
    },

    /**
     * Serializes an object into a json string
     * and stores it in local storage.
     *
     * @method setItem
     * @param {String} key The cache key
     * @param {Object} value The object
     */
    setItem: function setItem(key, value) {
      if (!isNone(value)) {
        value = stringify(value);
      }
      return localStorage.setItem(key, value);
    },

    /**
     * Deletes an entry from local storage.
     *
     * @method removeItem
     * @param  {String} key The cache key
     */
    removeItem: function removeItem(key) {
      return localStorage.removeItem(key);
    },

    /**
     * Returns the list keys of saved entries in local storage.
     *
     * @method keys
     * @return {Array}  The array of keys
     */
    keys: function keys() {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      return keys;
    }
  });
});
/**
 * Service that manages local storage. This service is useful because
 * it abstracts serialization and parsing of json.
 *
 * @class Local
 * @extends Service
 */
define('ember-inspector/services/storage/memory', ['exports', 'ember'], function (exports, _ember) {
  var Service = _ember['default'].Service;
  var computed = _ember['default'].computed;
  var _keys = Object.keys;
  exports['default'] = Service.extend({
    /**
     * Where data is stored.
     *
     * @property hash
     * @type {Object}
     */
    hash: computed(function () {
      return {};
    }),

    /**
     * Reads a stored item.
     *
     * @method getItem
     * @param  {String} key The cache key
     * @return {Object}     The stored value
     */
    getItem: function getItem(key) {
      return this.get('hash')[key];
    },

    /**
     * Stores an item in memory.
     *
     * @method setItem
     * @param {String} key The cache key
     * @param {Object} value The item
     */
    setItem: function setItem(key, value) {
      this.get('hash')[key] = value;
    },

    /**
     * Deletes an entry from memory storage.
     *
     * @method removeItem
     * @param  {String} key The cache key
     */
    removeItem: function removeItem(key) {
      delete this.get('hash')[key];
    },

    /**
     * Returns the list keys of saved entries in memory.
     *
     * @method keys
     * @return {Array}  The array of keys
     */
    keys: function keys() {
      return _keys(this.get('hash'));
    }
  });
});
/**
 * Service that manages storage in memory. Usually as a fallback
 * for local storage.
 *
 * @class Memory
 * @extends Service
 */
define("ember-inspector/templates/-main", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 16,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/-main.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "split__panel__hd");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "split__panel__bd");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "split__panel__ft");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2, "target", "_blank");
          dom.setAttribute(el2, "href", "https://github.com/emberjs/ember-inspector/issues");
          var el3 = dom.createTextNode("\n        Submit an Issue\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
          morphs[1] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
          return morphs;
        },
        statements: [["content", "iframe-picker", ["loc", [null, [6, 6], [6, 23]]]], ["inline", "partial", ["nav"], [], ["loc", [null, [9, 6], [9, 23]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 21,
              "column": 6
            },
            "end": {
              "line": 24,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/-main.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["inline", "sidebar-toggle", [], ["action", "toggleInspector", "side", "right", "isExpanded", false, "classNames", "toolbar__icon-button"], ["loc", [null, [22, 8], [23, 62]]]]],
        locals: [],
        templates: []
      };
    })();
    var child2 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 27,
              "column": 4
            },
            "end": {
              "line": 29,
              "column": 4
            }
          },
          "moduleName": "ember-inspector/templates/-main.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["content", "outlet", ["loc", [null, [28, 6], [28, 16]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 32,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/-main.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "split split--main");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "split__panel");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "split__panel__hd");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [3]);
        var element2 = dom.childAt(element1, [1]);
        var morphs = new Array(4);
        morphs[0] = dom.createMorphAt(element0, 1, 1);
        morphs[1] = dom.createMorphAt(element2, 1, 1);
        morphs[2] = dom.createMorphAt(element2, 3, 3);
        morphs[3] = dom.createMorphAt(element1, 3, 3);
        return morphs;
      },
      statements: [["block", "draggable-column", [], ["width", ["subexpr", "@mut", [["get", "navWidth", ["loc", [null, [3, 16], [3, 24]]]]], [], []], "classes", "split__panel split__panel--sidebar-1"], 0, null, ["loc", [null, [2, 2], [16, 23]]]], ["inline", "outlet", ["toolbar"], [], ["loc", [null, [20, 6], [20, 26]]]], ["block", "unless", [["get", "inspectorExpanded", ["loc", [null, [21, 16], [21, 33]]]]], [], 1, null, ["loc", [null, [21, 6], [24, 17]]]], ["block", "main-content", [], ["class", "split__panel__bd"], 2, null, ["loc", [null, [27, 4], [29, 21]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("ember-inspector/templates/application", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          var child0 = (function () {
            return {
              meta: {
                "fragmentReason": false,
                "revision": "Ember@2.6.2",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 9,
                    "column": 8
                  },
                  "end": {
                    "line": 14,
                    "column": 8
                  }
                },
                "moduleName": "ember-inspector/templates/application.hbs"
              },
              isEmpty: false,
              arity: 0,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("          ");
                dom.appendChild(el0, el1);
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                var morphs = new Array(1);
                morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
                return morphs;
              },
              statements: [["inline", "object-inspector", [], ["application", ["subexpr", "@mut", [["get", "this", ["loc", [null, [13, 41], [13, 45]]]]], [], []], "model", ["subexpr", "@mut", [["get", "mixinStack", ["loc", [null, [13, 52], [13, 62]]]]], [], []], "mixinDetails", ["subexpr", "@mut", [["get", "mixinDetails", ["loc", [null, [13, 76], [13, 88]]]]], [], []], "toggleInspector", "toggleInspector"], ["loc", [null, [13, 10], [13, 124]]]]],
              locals: [],
              templates: []
            };
          })();
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 8,
                  "column": 6
                },
                "end": {
                  "line": 15,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/application.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
              dom.insertBoundary(fragment, 0);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [["block", "draggable-column", [], ["side", "right", "width", ["subexpr", "@mut", [["get", "inspectorWidth", ["loc", [null, [11, 22], [11, 36]]]]], [], []], "classes", "split__panel"], 0, null, ["loc", [null, [9, 8], [14, 29]]]]],
            locals: [],
            templates: [child0]
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 18,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/application.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "split");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2, "class", "split__panel");
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n      ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var morphs = new Array(2);
            morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]), 1, 1);
            morphs[1] = dom.createMorphAt(element0, 3, 3);
            return morphs;
          },
          statements: [["inline", "partial", ["main"], [], ["loc", [null, [5, 8], [5, 26]]]], ["block", "if", [["get", "inspectorExpanded", ["loc", [null, [8, 12], [8, 29]]]]], [], 0, null, ["loc", [null, [8, 6], [15, 13]]]]],
          locals: [],
          templates: [child0]
        };
      })();
      var child1 = (function () {
        var child0 = (function () {
          var child0 = (function () {
            return {
              meta: {
                "fragmentReason": false,
                "revision": "Ember@2.6.2",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 22,
                    "column": 4
                  },
                  "end": {
                    "line": 30,
                    "column": 4
                  }
                },
                "moduleName": "ember-inspector/templates/application.hbs"
              },
              isEmpty: false,
              arity: 0,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("      ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("li");
                var el2 = dom.createTextNode("You are using the file:// protocol (instead of http://), in which case:\n        ");
                dom.appendChild(el1, el2);
                var el2 = dom.createElement("ul");
                var el3 = dom.createTextNode("\n          ");
                dom.appendChild(el2, el3);
                var el3 = dom.createElement("li");
                var el4 = dom.createTextNode("Visit the URL: chrome://extensions.");
                dom.appendChild(el3, el4);
                dom.appendChild(el2, el3);
                var el3 = dom.createTextNode("\n          ");
                dom.appendChild(el2, el3);
                var el3 = dom.createElement("li");
                var el4 = dom.createTextNode("Find the Ember Inspector.");
                dom.appendChild(el3, el4);
                dom.appendChild(el2, el3);
                var el3 = dom.createTextNode("\n          ");
                dom.appendChild(el2, el3);
                var el3 = dom.createElement("li");
                var el4 = dom.createTextNode("Make sure \"Allow access to file URLs\" is checked.");
                dom.appendChild(el3, el4);
                dom.appendChild(el2, el3);
                var el3 = dom.createTextNode("\n        ");
                dom.appendChild(el2, el3);
                dom.appendChild(el1, el2);
                var el2 = dom.createTextNode("\n      ");
                dom.appendChild(el1, el2);
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes() {
                return [];
              },
              statements: [],
              locals: [],
              templates: []
            };
          })();
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 19,
                  "column": 4
                },
                "end": {
                  "line": 31,
                  "column": 4
                }
              },
              "moduleName": "ember-inspector/templates/application.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("    ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("li");
              var el2 = dom.createTextNode("This is not an Ember application.");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n    ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("li");
              var el2 = dom.createTextNode("You are using an old version of Ember (< rc5).");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 5, 5, contextualElement);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [["block", "if", [["get", "isChrome", ["loc", [null, [22, 10], [22, 18]]]]], [], 0, null, ["loc", [null, [22, 4], [30, 11]]]]],
            locals: [],
            templates: [child0]
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 18,
                "column": 2
              },
              "end": {
                "line": 32,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/application.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [["block", "not-detected", [], ["description", "Ember application"], 0, null, ["loc", [null, [19, 4], [31, 21]]]]],
          locals: [],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 33,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/application.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "emberApplication", ["loc", [null, [2, 8], [2, 24]]]]], [], 0, 1, ["loc", [null, [2, 2], [32, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 34,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/application.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-app", [], ["active", ["subexpr", "@mut", [["get", "active", ["loc", [null, [1, 16], [1, 22]]]]], [], []], "isDragging", ["subexpr", "@mut", [["get", "isDragging", ["loc", [null, [1, 34], [1, 44]]]]], [], []]], 0, null, ["loc", [null, [1, 0], [33, 10]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/components/clear-button", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 7,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/clear-button.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        dom.setNamespace("http://www.w3.org/2000/svg");
        var el1 = dom.createElement("svg");
        dom.setAttribute(el1, "width", "16px");
        dom.setAttribute(el1, "height", "16px");
        dom.setAttribute(el1, "viewBox", "0 0 16 16");
        dom.setAttribute(el1, "version", "1.1");
        dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
        dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("g");
        dom.setAttribute(el2, "class", "svg-stroke");
        dom.setAttribute(el2, "transform", "translate(3.000000, 3.7500000)");
        dom.setAttribute(el2, "stroke", "#000000");
        dom.setAttribute(el2, "stroke-width", "2");
        dom.setAttribute(el2, "fill", "none");
        dom.setAttribute(el2, "fill-rule", "evenodd");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("circle");
        dom.setAttribute(el3, "cx", "5.5");
        dom.setAttribute(el3, "cy", "5.5");
        dom.setAttribute(el3, "r", "5.5");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("path");
        dom.setAttribute(el3, "d", "M1.98253524,1.98253524 L9,9");
        dom.setAttribute(el3, "id", "Line");
        dom.setAttribute(el3, "stroke-linecap", "square");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/deprecation-item-source", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/deprecation-item-source.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["inline", "yield", [["get", "this", ["loc", [null, [1, 8], [1, 12]]]]], [], ["loc", [null, [1, 0], [1, 14]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/deprecation-item", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 6,
                "column": 4
              },
              "end": {
                "line": 10,
                "column": 4
              }
            },
            "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("a");
            dom.setAttribute(el1, "class", "external-link js-deprecation-url");
            dom.setAttribute(el1, "target", "_blank");
            dom.setAttribute(el1, "title", "Transition Plan");
            var el2 = dom.createTextNode("\n        Transition Plan\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element4 = dom.childAt(fragment, [1]);
            var morphs = new Array(1);
            morphs[0] = dom.createAttrMorph(element4, 'href');
            return morphs;
          },
          statements: [["attribute", "href", ["get", "model.url", ["loc", [null, [7, 16], [7, 25]]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 11,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "list__cell-arrow");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1, "class", "pill pill_not-clickable js-deprecation-count");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1, "class", "js-deprecation-message");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(3);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [3]), 0, 0);
          morphs[1] = dom.createMorphAt(dom.childAt(fragment, [5]), 0, 0);
          morphs[2] = dom.createMorphAt(fragment, 7, 7, contextualElement);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["content", "model.count", ["loc", [null, [4, 63], [4, 78]]]], ["content", "model.message", ["loc", [null, [5, 41], [5, 58]]]], ["block", "if", [["get", "model.url", ["loc", [null, [6, 10], [6, 19]]]]], [], 0, null, ["loc", [null, [6, 4], [10, 11]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    var child1 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          var child0 = (function () {
            var child0 = (function () {
              var child0 = (function () {
                return {
                  meta: {
                    "fragmentReason": false,
                    "revision": "Ember@2.6.2",
                    "loc": {
                      "source": null,
                      "start": {
                        "line": 20,
                        "column": 14
                      },
                      "end": {
                        "line": 22,
                        "column": 14
                      }
                    },
                    "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
                  },
                  isEmpty: false,
                  arity: 0,
                  cachedFragment: null,
                  hasRendered: false,
                  buildFragment: function buildFragment(dom) {
                    var el0 = dom.createDocumentFragment();
                    var el1 = dom.createTextNode("                ");
                    dom.appendChild(el0, el1);
                    var el1 = dom.createElement("a");
                    dom.setAttribute(el1, "class", "js-deprecation-source-link");
                    dom.setAttribute(el1, "href", "#");
                    var el2 = dom.createComment("");
                    dom.appendChild(el1, el2);
                    dom.appendChild(el0, el1);
                    var el1 = dom.createTextNode("\n");
                    dom.appendChild(el0, el1);
                    return el0;
                  },
                  buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                    var element2 = dom.childAt(fragment, [1]);
                    var morphs = new Array(2);
                    morphs[0] = dom.createElementMorph(element2);
                    morphs[1] = dom.createMorphAt(element2, 0, 0);
                    return morphs;
                  },
                  statements: [["element", "action", [["get", "openResource", ["loc", [null, [21, 72], [21, 84]]]], ["get", "source.model.map", ["loc", [null, [21, 85], [21, 101]]]]], [], ["loc", [null, [21, 63], [21, 103]]]], ["content", "source.url", ["loc", [null, [21, 104], [21, 118]]]]],
                  locals: [],
                  templates: []
                };
              })();
              var child1 = (function () {
                return {
                  meta: {
                    "fragmentReason": false,
                    "revision": "Ember@2.6.2",
                    "loc": {
                      "source": null,
                      "start": {
                        "line": 22,
                        "column": 14
                      },
                      "end": {
                        "line": 24,
                        "column": 14
                      }
                    },
                    "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
                  },
                  isEmpty: false,
                  arity: 0,
                  cachedFragment: null,
                  hasRendered: false,
                  buildFragment: function buildFragment(dom) {
                    var el0 = dom.createDocumentFragment();
                    var el1 = dom.createTextNode("                ");
                    dom.appendChild(el0, el1);
                    var el1 = dom.createElement("span");
                    dom.setAttribute(el1, "class", "js-deprecation-source-text");
                    var el2 = dom.createComment("");
                    dom.appendChild(el1, el2);
                    dom.appendChild(el0, el1);
                    var el1 = dom.createTextNode("\n");
                    dom.appendChild(el0, el1);
                    return el0;
                  },
                  buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                    var morphs = new Array(1);
                    morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
                    return morphs;
                  },
                  statements: [["content", "source.url", ["loc", [null, [23, 57], [23, 71]]]]],
                  locals: [],
                  templates: []
                };
              })();
              return {
                meta: {
                  "fragmentReason": false,
                  "revision": "Ember@2.6.2",
                  "loc": {
                    "source": null,
                    "start": {
                      "line": 18,
                      "column": 10
                    },
                    "end": {
                      "line": 26,
                      "column": 10
                    }
                  },
                  "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
                },
                isEmpty: false,
                arity: 0,
                cachedFragment: null,
                hasRendered: false,
                buildFragment: function buildFragment(dom) {
                  var el0 = dom.createDocumentFragment();
                  var el1 = dom.createTextNode("            ");
                  dom.appendChild(el0, el1);
                  var el1 = dom.createElement("span");
                  dom.setAttribute(el1, "class", "source");
                  var el2 = dom.createTextNode("\n");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createComment("");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createTextNode("            ");
                  dom.appendChild(el1, el2);
                  dom.appendChild(el0, el1);
                  var el1 = dom.createTextNode("\n");
                  dom.appendChild(el0, el1);
                  return el0;
                },
                buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                  var morphs = new Array(1);
                  morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
                  return morphs;
                },
                statements: [["block", "if", [["get", "source.isClickable", ["loc", [null, [20, 20], [20, 38]]]]], [], 0, 1, ["loc", [null, [20, 14], [24, 21]]]]],
                locals: [],
                templates: [child0, child1]
              };
            })();
            var child1 = (function () {
              return {
                meta: {
                  "fragmentReason": false,
                  "revision": "Ember@2.6.2",
                  "loc": {
                    "source": null,
                    "start": {
                      "line": 27,
                      "column": 10
                    },
                    "end": {
                      "line": 32,
                      "column": 10
                    }
                  },
                  "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
                },
                isEmpty: false,
                arity: 0,
                cachedFragment: null,
                hasRendered: false,
                buildFragment: function buildFragment(dom) {
                  var el0 = dom.createDocumentFragment();
                  var el1 = dom.createTextNode("               \n            ");
                  dom.appendChild(el0, el1);
                  var el1 = dom.createElement("span");
                  dom.setAttribute(el1, "class", "send-trace-to-console js-trace-deprecations-btn");
                  dom.setAttribute(el1, "title", "Trace deprecations in console");
                  var el2 = dom.createTextNode("\n              Trace in the console\n            ");
                  dom.appendChild(el1, el2);
                  dom.appendChild(el0, el1);
                  var el1 = dom.createTextNode("\n");
                  dom.appendChild(el0, el1);
                  return el0;
                },
                buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                  var element1 = dom.childAt(fragment, [1]);
                  var morphs = new Array(1);
                  morphs[0] = dom.createElementMorph(element1);
                  return morphs;
                },
                statements: [["element", "action", [["get", "traceSource", ["loc", [null, [29, 83], [29, 94]]]], ["get", "model", ["loc", [null, [29, 95], [29, 100]]]], ["get", "source.model", ["loc", [null, [29, 101], [29, 113]]]]], [], ["loc", [null, [29, 74], [29, 115]]]]],
                locals: [],
                templates: []
              };
            })();
            return {
              meta: {
                "fragmentReason": false,
                "revision": "Ember@2.6.2",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 16,
                    "column": 6
                  },
                  "end": {
                    "line": 34,
                    "column": 6
                  }
                },
                "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
              },
              isEmpty: false,
              arity: 1,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("        ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("tr");
                dom.setAttribute(el1, "class", "list__row js-deprecation-source");
                var el2 = dom.createTextNode("\n");
                dom.appendChild(el1, el2);
                var el2 = dom.createComment("");
                dom.appendChild(el1, el2);
                var el2 = dom.createComment("");
                dom.appendChild(el1, el2);
                var el2 = dom.createTextNode("        ");
                dom.appendChild(el1, el2);
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                var element3 = dom.childAt(fragment, [1]);
                var morphs = new Array(2);
                morphs[0] = dom.createMorphAt(element3, 1, 1);
                morphs[1] = dom.createMorphAt(element3, 2, 2);
                return morphs;
              },
              statements: [["block", "list.cell", [], ["class", "list__cell_main list__cell_size_larger", "style", "padding-left:48px"], 0, null, ["loc", [null, [18, 10], [26, 24]]]], ["block", "list.cell", [], [], 1, null, ["loc", [null, [27, 10], [32, 24]]]]],
              locals: ["source"],
              templates: [child0, child1]
            };
          })();
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 15,
                  "column": 4
                },
                "end": {
                  "line": 35,
                  "column": 4
                }
              },
              "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
              dom.insertBoundary(fragment, 0);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [["block", "deprecation-item-source", [], ["model", ["subexpr", "@mut", [["get", "single", ["loc", [null, [16, 39], [16, 45]]]]], [], []]], 0, null, ["loc", [null, [16, 6], [34, 34]]]]],
            locals: ["single"],
            templates: [child0]
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 14,
                "column": 2
              },
              "end": {
                "line": 36,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [["block", "each", [["get", "model.sources", ["loc", [null, [15, 12], [15, 25]]]]], [], 0, null, ["loc", [null, [15, 4], [35, 13]]]]],
          locals: [],
          templates: [child0]
        };
      })();
      var child1 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 38,
                  "column": 6
                },
                "end": {
                  "line": 42,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("div");
              dom.setAttribute(el1, "class", "send-trace-to-console js-full-trace-deprecations-btn");
              dom.setAttribute(el1, "title", "Trace deprecations in console");
              var el2 = dom.createTextNode("\n          Trace in the console\n        ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element0 = dom.childAt(fragment, [1]);
              var morphs = new Array(1);
              morphs[0] = dom.createElementMorph(element0);
              return morphs;
            },
            statements: [["element", "action", [["get", "traceDeprecations", ["loc", [null, [39, 83], [39, 100]]]], ["get", "model", ["loc", [null, [39, 101], [39, 106]]]]], [], ["loc", [null, [39, 74], [39, 108]]]]],
            locals: [],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 36,
                "column": 2
              },
              "end": {
                "line": 44,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("tr");
            dom.setAttribute(el1, "class", "list__row js-deprecation-full-trace");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
            return morphs;
          },
          statements: [["block", "list.cell", [], ["class", "list__cell_main", "clickable", true, "style", "padding-left:48px"], 0, null, ["loc", [null, [38, 6], [42, 20]]]]],
          locals: [],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 13,
              "column": 0
            },
            "end": {
              "line": 45,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "model.hasSourceMap", ["loc", [null, [14, 8], [14, 26]]]]], [], 0, 1, ["loc", [null, [14, 2], [44, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["multiple-nodes", "wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 46,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/deprecation-item.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("tr");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element5 = dom.childAt(fragment, [0]);
        var morphs = new Array(4);
        morphs[0] = dom.createAttrMorph(element5, 'class');
        morphs[1] = dom.createElementMorph(element5);
        morphs[2] = dom.createMorphAt(element5, 1, 1);
        morphs[3] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["attribute", "class", ["concat", ["list__row ", ["subexpr", "if", [["get", "isExpanded", ["loc", [null, [1, 26], [1, 36]]]], "list__row_arrow_expanded", "list__row_arrow_collapsed"], [], ["loc", [null, [1, 21], [1, 93]]]], " js-deprecation-item"]]], ["element", "action", ["toggleExpand"], [], ["loc", [null, [1, 115], [1, 140]]]], ["block", "list.cell", [], ["class", "list__cell_main js-deprecation-main-cell", "title", ["subexpr", "@mut", [["get", "model.message", ["loc", [null, [2, 70], [2, 83]]]]], [], []]], 0, null, ["loc", [null, [2, 2], [11, 16]]]], ["block", "if", [["get", "isExpanded", ["loc", [null, [13, 6], [13, 16]]]]], [], 1, null, ["loc", [null, [13, 0], [45, 7]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/components/drag-handle", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/drag-handle.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "drag-handle__border");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/draggable-column", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 3,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/draggable-column.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["content", "yield", ["loc", [null, [2, 2], [2, 11]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/draggable-column.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["block", "resizable-column", [], ["width", ["subexpr", "@mut", [["get", "width", ["loc", [null, [1, 26], [1, 31]]]]], [], []], "class", ["subexpr", "@mut", [["get", "classes", ["loc", [null, [1, 38], [1, 45]]]]], [], []]], 0, null, ["loc", [null, [1, 0], [3, 21]]]], ["inline", "drag-handle", [], ["side", ["subexpr", "@mut", [["get", "side", ["loc", [null, [5, 19], [5, 23]]]]], [], []], "position", ["subexpr", "@mut", [["get", "width", ["loc", [null, [5, 33], [5, 38]]]]], [], []], "minWidth", ["subexpr", "@mut", [["get", "minWidth", ["loc", [null, [5, 48], [5, 56]]]]], [], []], "action", "setIsDragging", "on-drag", ["subexpr", "action", ["didDrag"], [], ["loc", [null, [5, 88], [5, 106]]]]], ["loc", [null, [5, 0], [5, 108]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/components/expandable-render", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 3,
                "column": 25
              },
              "end": {
                "line": 3,
                "column": 42
              }
            },
            "moduleName": "ember-inspector/templates/components/expandable-render.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("-");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 3,
                "column": 42
              },
              "end": {
                "line": 3,
                "column": 51
              }
            },
            "moduleName": "ember-inspector/templates/components/expandable-render.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("+");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "modifiers",
            "modifiers": ["action"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 5,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/expandable-render.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("a");
          dom.setAttribute(el1, "href", "#");
          dom.setAttribute(el1, "class", "title");
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "expander");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode(" ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "duration");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [0]);
          var morphs = new Array(4);
          morphs[0] = dom.createElementMorph(element1);
          morphs[1] = dom.createMorphAt(dom.childAt(element1, [1]), 0, 0);
          morphs[2] = dom.createMorphAt(element1, 3, 3);
          morphs[3] = dom.createMorphAt(dom.childAt(element1, [5]), 0, 0);
          return morphs;
        },
        statements: [["element", "action", ["expand"], [], ["loc", [null, [2, 12], [2, 31]]]], ["block", "if", [["get", "expanded", ["loc", [null, [3, 31], [3, 39]]]]], [], 0, 1, ["loc", [null, [3, 25], [3, 58]]]], ["inline", "unbound", [["get", "node.name", ["loc", [null, [4, 12], [4, 21]]]]], [], ["loc", [null, [4, 2], [4, 23]]]], ["inline", "unbound", [["get", "node.duration", ["loc", [null, [4, 57], [4, 70]]]]], [], ["loc", [null, [4, 47], [4, 72]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 5,
              "column": 0
            },
            "end": {
              "line": 7,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/expandable-render.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "title");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode(" ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "duration");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(element0, 0, 0);
          morphs[1] = dom.createMorphAt(dom.childAt(element0, [2]), 0, 0);
          return morphs;
        },
        statements: [["inline", "unbound", [["get", "node.name", ["loc", [null, [6, 31], [6, 40]]]]], [], ["loc", [null, [6, 21], [6, 42]]]], ["inline", "unbound", [["get", "node.duration", ["loc", [null, [6, 76], [6, 89]]]]], [], ["loc", [null, [6, 66], [6, 91]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 8,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/expandable-render.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "node.children", ["loc", [null, [1, 6], [1, 19]]]]], [], 0, 1, ["loc", [null, [1, 0], [7, 7]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/components/iframe-picker", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 3,
              "column": 4
            },
            "end": {
              "line": 5,
              "column": 4
            }
          },
          "moduleName": "ember-inspector/templates/components/iframe-picker.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("option");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createAttrMorph(element0, 'value');
          morphs[1] = dom.createMorphAt(element0, 0, 0);
          return morphs;
        },
        statements: [["attribute", "value", ["get", "iframe.val", ["loc", [null, [4, 22], [4, 32]]]]], ["content", "iframe.name", ["loc", [null, [4, 35], [4, 50]]]]],
        locals: ["iframe"],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 9,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/iframe-picker.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "dropdown");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("select");
        dom.setAttribute(el2, "class", "dropdown__select");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "dropdown__arrow");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0, 1]);
        var morphs = new Array(2);
        morphs[0] = dom.createAttrMorph(element1, 'onchange');
        morphs[1] = dom.createMorphAt(element1, 1, 1);
        return morphs;
      },
      statements: [["attribute", "onchange", ["subexpr", "action", ["selectIframe"], ["value", "target.value"], ["loc", [null, [2, 44], [2, 90]]]]], ["block", "each", [["get", "model", ["loc", [null, [3, 12], [3, 17]]]]], [], 0, null, ["loc", [null, [3, 4], [5, 13]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/components/mixin-detail", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/mixin-detail.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["inline", "yield", [["get", "this", ["loc", [null, [1, 8], [1, 12]]]]], [], ["loc", [null, [1, 0], [1, 14]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/mixin-details", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 10,
                "column": 2
              },
              "end": {
                "line": 14,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "mixin__error js-object-inspector-error");
            var el2 = dom.createTextNode("\n      Error while computing: ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
            return morphs;
          },
          statements: [["content", "error.property", ["loc", [null, [12, 29], [12, 47]]]]],
          locals: ["error"],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "triple-curlies"
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 17,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "mixin mixin_props_no js-object-inspector-errors");
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h2");
          dom.setAttribute(el2, "class", "mixin__name mixin__name_errors");
          var el3 = dom.createTextNode("\n    Errors\n    ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("span");
          dom.setAttribute(el3, "class", "send-trace-to-console js-send-errors-to-console");
          var el4 = dom.createTextNode("\n      Trace in the console\n    ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n  ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "mixin__properties");
          var el3 = dom.createTextNode("\n");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("  ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element6 = dom.childAt(fragment, [0]);
          var element7 = dom.childAt(element6, [1, 1]);
          var morphs = new Array(2);
          morphs[0] = dom.createElementMorph(element7);
          morphs[1] = dom.createMorphAt(dom.childAt(element6, [3]), 1, 1);
          return morphs;
        },
        statements: [["element", "action", ["traceErrors"], [], ["loc", [null, [5, 10], [5, 34]]]], ["block", "each", [["get", "model.errors", ["loc", [null, [10, 10], [10, 22]]]]], [], 0, null, ["loc", [null, [10, 2], [14, 11]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    var child1 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 21,
                  "column": 6
                },
                "end": {
                  "line": 23,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("h2");
              dom.setAttribute(el1, "class", "mixin__name js-object-detail-name");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element4 = dom.childAt(fragment, [1]);
              var morphs = new Array(2);
              morphs[0] = dom.createElementMorph(element4);
              morphs[1] = dom.createMorphAt(element4, 0, 0);
              return morphs;
            },
            statements: [["element", "action", ["toggleExpanded"], ["target", ["get", "mixin", ["loc", [null, [22, 87], [22, 92]]]]], ["loc", [null, [22, 54], [22, 94]]]], ["content", "mixin.model.name", ["loc", [null, [22, 95], [22, 115]]]]],
            locals: [],
            templates: []
          };
        })();
        var child1 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 23,
                  "column": 6
                },
                "end": {
                  "line": 25,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("h2");
              dom.setAttribute(el1, "class", "mixin__name js-object-detail-name");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
              return morphs;
            },
            statements: [["content", "mixin.model.name", ["loc", [null, [24, 54], [24, 74]]]]],
            locals: [],
            templates: []
          };
        })();
        var child2 = (function () {
          var child0 = (function () {
            var child0 = (function () {
              var child0 = (function () {
                return {
                  meta: {
                    "fragmentReason": false,
                    "revision": "Ember@2.6.2",
                    "loc": {
                      "source": null,
                      "start": {
                        "line": 31,
                        "column": 16
                      },
                      "end": {
                        "line": 33,
                        "column": 16
                      }
                    },
                    "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                  },
                  isEmpty: false,
                  arity: 0,
                  cachedFragment: null,
                  hasRendered: false,
                  buildFragment: function buildFragment(dom) {
                    var el0 = dom.createDocumentFragment();
                    var el1 = dom.createTextNode("                  ");
                    dom.appendChild(el0, el1);
                    var el1 = dom.createElement("button");
                    var el2 = dom.createElement("img");
                    dom.setAttribute(el2, "src", "assets/images/calculate.svg");
                    dom.appendChild(el1, el2);
                    dom.appendChild(el0, el1);
                    var el1 = dom.createTextNode("\n");
                    dom.appendChild(el0, el1);
                    return el0;
                  },
                  buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                    var element1 = dom.childAt(fragment, [1]);
                    var morphs = new Array(2);
                    morphs[0] = dom.createAttrMorph(element1, 'class');
                    morphs[1] = dom.createElementMorph(element1);
                    return morphs;
                  },
                  statements: [["attribute", "class", ["concat", ["mixin__calc-btn ", ["subexpr", "if", [["get", "property.isCalculated", ["loc", [null, [32, 54], [32, 75]]]], "mixin__calc-btn_calculated"], [], ["loc", [null, [32, 49], [32, 106]]]], " js-calculate"]]], ["element", "action", ["calculate", ["get", "property.model", ["loc", [null, [32, 142], [32, 156]]]]], ["bubbles", false, "target", ["get", "mixin", ["loc", [null, [32, 178], [32, 183]]]]], ["loc", [null, [32, 121], [32, 185]]]]],
                  locals: [],
                  templates: []
                };
              })();
              var child1 = (function () {
                return {
                  meta: {
                    "fragmentReason": false,
                    "revision": "Ember@2.6.2",
                    "loc": {
                      "source": null,
                      "start": {
                        "line": 33,
                        "column": 16
                      },
                      "end": {
                        "line": 35,
                        "column": 16
                      }
                    },
                    "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                  },
                  isEmpty: false,
                  arity: 0,
                  cachedFragment: null,
                  hasRendered: false,
                  buildFragment: function buildFragment(dom) {
                    var el0 = dom.createDocumentFragment();
                    var el1 = dom.createTextNode("                  ");
                    dom.appendChild(el0, el1);
                    var el1 = dom.createElement("span");
                    dom.setAttribute(el1, "class", "pad");
                    dom.appendChild(el0, el1);
                    var el1 = dom.createTextNode("\n");
                    dom.appendChild(el0, el1);
                    return el0;
                  },
                  buildRenderNodes: function buildRenderNodes() {
                    return [];
                  },
                  statements: [],
                  locals: [],
                  templates: []
                };
              })();
              var child2 = (function () {
                return {
                  meta: {
                    "fragmentReason": false,
                    "revision": "Ember@2.6.2",
                    "loc": {
                      "source": null,
                      "start": {
                        "line": 37,
                        "column": 16
                      },
                      "end": {
                        "line": 39,
                        "column": 16
                      }
                    },
                    "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                  },
                  isEmpty: false,
                  arity: 0,
                  cachedFragment: null,
                  hasRendered: false,
                  buildFragment: function buildFragment(dom) {
                    var el0 = dom.createDocumentFragment();
                    var el1 = dom.createTextNode("                  ");
                    dom.appendChild(el0, el1);
                    var el1 = dom.createElement("span");
                    var el2 = dom.createComment("");
                    dom.appendChild(el1, el2);
                    dom.appendChild(el0, el1);
                    var el1 = dom.createTextNode("\n");
                    dom.appendChild(el0, el1);
                    return el0;
                  },
                  buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                    var element0 = dom.childAt(fragment, [1]);
                    var morphs = new Array(3);
                    morphs[0] = dom.createAttrMorph(element0, 'class');
                    morphs[1] = dom.createElementMorph(element0);
                    morphs[2] = dom.createMorphAt(element0, 0, 0);
                    return morphs;
                  },
                  statements: [["attribute", "class", ["concat", [["get", "property.model.value.type", ["loc", [null, [38, 89], [38, 114]]]], " mixin__property-value js-object-property-value"]]], ["element", "action", ["valueClick", ["get", "property.model", ["loc", [null, [38, 47], [38, 61]]]]], ["target", ["get", "property", ["loc", [null, [38, 69], [38, 77]]]]], ["loc", [null, [38, 25], [38, 79]]]], ["content", "property.model.value.inspect", ["loc", [null, [38, 165], [38, 197]]]]],
                  locals: [],
                  templates: []
                };
              })();
              var child3 = (function () {
                var child0 = (function () {
                  return {
                    meta: {
                      "fragmentReason": false,
                      "revision": "Ember@2.6.2",
                      "loc": {
                        "source": null,
                        "start": {
                          "line": 40,
                          "column": 18
                        },
                        "end": {
                          "line": 43,
                          "column": 18
                        }
                      },
                      "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                    },
                    isEmpty: false,
                    arity: 0,
                    cachedFragment: null,
                    hasRendered: false,
                    buildFragment: function buildFragment(dom) {
                      var el0 = dom.createDocumentFragment();
                      var el1 = dom.createTextNode("                    ");
                      dom.appendChild(el0, el1);
                      var el1 = dom.createComment("");
                      dom.appendChild(el0, el1);
                      var el1 = dom.createTextNode("\n");
                      dom.appendChild(el0, el1);
                      return el0;
                    },
                    buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                      var morphs = new Array(1);
                      morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
                      return morphs;
                    },
                    statements: [["inline", "property-field", [], ["value", ["subexpr", "@mut", [["get", "property.txtValue", ["loc", [null, [41, 43], [41, 60]]]]], [], []], "finished-editing", "finishedEditing", "save-property", "saveProperty", "propertyComponent", ["subexpr", "@mut", [["get", "property", ["loc", [null, [41, 143], [41, 151]]]]], [], []], "class", "mixin__property-value-txt js-object-property-value-txt"], ["loc", [null, [41, 20], [42, 85]]]]],
                    locals: [],
                    templates: []
                  };
                })();
                var child1 = (function () {
                  return {
                    meta: {
                      "fragmentReason": false,
                      "revision": "Ember@2.6.2",
                      "loc": {
                        "source": null,
                        "start": {
                          "line": 43,
                          "column": 18
                        },
                        "end": {
                          "line": 46,
                          "column": 18
                        }
                      },
                      "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                    },
                    isEmpty: false,
                    arity: 0,
                    cachedFragment: null,
                    hasRendered: false,
                    buildFragment: function buildFragment(dom) {
                      var el0 = dom.createDocumentFragment();
                      var el1 = dom.createTextNode("                    ");
                      dom.appendChild(el0, el1);
                      var el1 = dom.createComment("");
                      dom.appendChild(el0, el1);
                      var el1 = dom.createTextNode("\n");
                      dom.appendChild(el0, el1);
                      return el0;
                    },
                    buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                      var morphs = new Array(1);
                      morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
                      return morphs;
                    },
                    statements: [["inline", "date-property-field", [], ["value", ["subexpr", "@mut", [["get", "property.dateValue", ["loc", [null, [44, 48], [44, 66]]]]], [], []], "format", "YYYY-MM-DD", "class", "mixin__property-value-txt js-object-property-value-date", "onSelection", ["subexpr", "action", ["dateSelected"], ["target", ["get", "property", ["loc", [null, [45, 127], [45, 135]]]]], ["loc", [null, [45, 97], [45, 136]]]], "cancel", ["subexpr", "action", ["finishedEditing"], ["target", ["get", "property", ["loc", [null, [45, 177], [45, 185]]]]], ["loc", [null, [45, 144], [45, 186]]]]], ["loc", [null, [44, 20], [45, 188]]]]],
                    locals: [],
                    templates: []
                  };
                })();
                return {
                  meta: {
                    "fragmentReason": false,
                    "revision": "Ember@2.6.2",
                    "loc": {
                      "source": null,
                      "start": {
                        "line": 39,
                        "column": 16
                      },
                      "end": {
                        "line": 47,
                        "column": 16
                      }
                    },
                    "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                  },
                  isEmpty: false,
                  arity: 0,
                  cachedFragment: null,
                  hasRendered: false,
                  buildFragment: function buildFragment(dom) {
                    var el0 = dom.createDocumentFragment();
                    var el1 = dom.createComment("");
                    dom.appendChild(el0, el1);
                    return el0;
                  },
                  buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                    var morphs = new Array(1);
                    morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
                    dom.insertBoundary(fragment, 0);
                    dom.insertBoundary(fragment, null);
                    return morphs;
                  },
                  statements: [["block", "unless", [["get", "property.isDate", ["loc", [null, [40, 28], [40, 43]]]]], [], 0, 1, ["loc", [null, [40, 18], [46, 29]]]]],
                  locals: [],
                  templates: [child0, child1]
                };
              })();
              return {
                meta: {
                  "fragmentReason": false,
                  "revision": "Ember@2.6.2",
                  "loc": {
                    "source": null,
                    "start": {
                      "line": 29,
                      "column": 12
                    },
                    "end": {
                      "line": 51,
                      "column": 12
                    }
                  },
                  "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
                },
                isEmpty: false,
                arity: 1,
                cachedFragment: null,
                hasRendered: false,
                buildFragment: function buildFragment(dom) {
                  var el0 = dom.createDocumentFragment();
                  var el1 = dom.createTextNode("              ");
                  dom.appendChild(el0, el1);
                  var el1 = dom.createElement("li");
                  var el2 = dom.createTextNode("\n");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createComment("");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createTextNode("                ");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createElement("span");
                  dom.setAttribute(el2, "class", "mixin__property-name js-object-property-name");
                  var el3 = dom.createComment("");
                  dom.appendChild(el2, el3);
                  dom.appendChild(el1, el2);
                  var el2 = dom.createElement("span");
                  dom.setAttribute(el2, "class", "mixin__property-value-separator");
                  var el3 = dom.createTextNode(": ");
                  dom.appendChild(el2, el3);
                  dom.appendChild(el1, el2);
                  var el2 = dom.createTextNode("\n");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createComment("");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createTextNode("                ");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createElement("span");
                  dom.setAttribute(el2, "class", "mixin__property-overridden-by");
                  var el3 = dom.createTextNode("(Overridden by ");
                  dom.appendChild(el2, el3);
                  var el3 = dom.createComment("");
                  dom.appendChild(el2, el3);
                  var el3 = dom.createTextNode(")");
                  dom.appendChild(el2, el3);
                  dom.appendChild(el1, el2);
                  var el2 = dom.createTextNode("\n                ");
                  dom.appendChild(el1, el2);
                  var el2 = dom.createElement("button");
                  dom.setAttribute(el2, "class", "mixin__send-btn js-send-to-console-btn");
                  var el3 = dom.createElement("img");
                  dom.setAttribute(el3, "src", "assets/images/send.png");
                  dom.setAttribute(el3, "title", "Send to console");
                  dom.appendChild(el2, el3);
                  dom.appendChild(el1, el2);
                  var el2 = dom.createTextNode("\n              ");
                  dom.appendChild(el1, el2);
                  dom.appendChild(el0, el1);
                  var el1 = dom.createTextNode("\n");
                  dom.appendChild(el0, el1);
                  return el0;
                },
                buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                  var element2 = dom.childAt(fragment, [1]);
                  var element3 = dom.childAt(element2, [10]);
                  var morphs = new Array(6);
                  morphs[0] = dom.createAttrMorph(element2, 'class');
                  morphs[1] = dom.createMorphAt(element2, 1, 1);
                  morphs[2] = dom.createMorphAt(dom.childAt(element2, [3]), 0, 0);
                  morphs[3] = dom.createMorphAt(element2, 6, 6);
                  morphs[4] = dom.createMorphAt(dom.childAt(element2, [8]), 1, 1);
                  morphs[5] = dom.createElementMorph(element3);
                  return morphs;
                },
                statements: [["attribute", "class", ["concat", [["subexpr", "if", [["get", "property.model.overridden", ["loc", [null, [30, 30], [30, 55]]]], "mixin__property_state_overridden"], [], ["loc", [null, [30, 25], [30, 92]]]], " mixin__property js-object-property"]]], ["block", "if", [["get", "property.model.value.computed", ["loc", [null, [31, 22], [31, 51]]]]], [], 0, 1, ["loc", [null, [31, 16], [35, 23]]]], ["content", "property.model.name", ["loc", [null, [36, 75], [36, 98]]]], ["block", "unless", [["get", "property.isEdit", ["loc", [null, [37, 26], [37, 41]]]]], [], 2, 3, ["loc", [null, [37, 16], [47, 27]]]], ["content", "property.model.overridden", ["loc", [null, [48, 75], [48, 104]]]], ["element", "action", ["sendToConsole", ["get", "property.model", ["loc", [null, [49, 96], [49, 110]]]]], ["target", ["get", "mixin", ["loc", [null, [49, 118], [49, 123]]]]], ["loc", [null, [49, 71], [49, 125]]]]],
                locals: ["property"],
                templates: [child0, child1, child2, child3]
              };
            })();
            return {
              meta: {
                "fragmentReason": false,
                "revision": "Ember@2.6.2",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 28,
                    "column": 10
                  },
                  "end": {
                    "line": 52,
                    "column": 10
                  }
                },
                "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
              },
              isEmpty: false,
              arity: 1,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                var morphs = new Array(1);
                morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
                dom.insertBoundary(fragment, 0);
                dom.insertBoundary(fragment, null);
                return morphs;
              },
              statements: [["block", "mixin-property", [], ["model", ["subexpr", "@mut", [["get", "prop", ["loc", [null, [29, 36], [29, 40]]]]], [], []], "mixin", ["subexpr", "@mut", [["get", "mixin", ["loc", [null, [29, 47], [29, 52]]]]], [], []]], 0, null, ["loc", [null, [29, 12], [51, 31]]]]],
              locals: ["prop"],
              templates: [child0]
            };
          })();
          var child1 = (function () {
            return {
              meta: {
                "fragmentReason": false,
                "revision": "Ember@2.6.2",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 52,
                    "column": 10
                  },
                  "end": {
                    "line": 54,
                    "column": 10
                  }
                },
                "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
              },
              isEmpty: false,
              arity: 0,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("            ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("li");
                dom.setAttribute(el1, "class", "mixin__property");
                var el2 = dom.createTextNode("No Properties");
                dom.appendChild(el1, el2);
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes() {
                return [];
              },
              statements: [],
              locals: [],
              templates: []
            };
          })();
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 26,
                  "column": 6
                },
                "end": {
                  "line": 56,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("ul");
              dom.setAttribute(el1, "class", "mixin__properties");
              var el2 = dom.createTextNode("\n");
              dom.appendChild(el1, el2);
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("        ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
              return morphs;
            },
            statements: [["block", "each", [["get", "mixin.model.properties", ["loc", [null, [28, 18], [28, 40]]]]], [], 0, 1, ["loc", [null, [28, 10], [54, 19]]]]],
            locals: [],
            templates: [child0, child1]
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 19,
                "column": 2
              },
              "end": {
                "line": 58,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element5 = dom.childAt(fragment, [1]);
            var morphs = new Array(3);
            morphs[0] = dom.createAttrMorph(element5, 'class');
            morphs[1] = dom.createMorphAt(element5, 1, 1);
            morphs[2] = dom.createMorphAt(element5, 2, 2);
            return morphs;
          },
          statements: [["attribute", "class", ["concat", ["mixin ", ["get", "mixin.model.type", ["loc", [null, [20, 24], [20, 40]]]], " ", ["subexpr", "if", [["get", "mixin.isExpanded", ["loc", [null, [20, 48], [20, 64]]]], "mixin_state_expanded"], [], ["loc", [null, [20, 43], [20, 89]]]], " ", ["subexpr", "if", [["get", "mixin.model.properties.length", ["loc", [null, [20, 95], [20, 124]]]], "mixin_props_yes", "mixin_props_no"], [], ["loc", [null, [20, 90], [20, 161]]]], " js-object-detail"]]], ["block", "if", [["get", "mixin.model.properties.length", ["loc", [null, [21, 12], [21, 41]]]]], [], 0, 1, ["loc", [null, [21, 6], [25, 13]]]], ["block", "if", [["get", "mixin.isExpanded", ["loc", [null, [26, 12], [26, 28]]]]], [], 2, null, ["loc", [null, [26, 6], [56, 13]]]]],
          locals: ["mixin"],
          templates: [child0, child1, child2]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 18,
              "column": 0
            },
            "end": {
              "line": 59,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "mixin-detail", [], ["model", ["subexpr", "@mut", [["get", "item", ["loc", [null, [19, 24], [19, 28]]]]], [], []], "mixinDetails", ["subexpr", "@mut", [["get", "this", ["loc", [null, [19, 42], [19, 46]]]]], [], []]], 0, null, ["loc", [null, [19, 2], [58, 19]]]]],
        locals: ["item"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 60,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/mixin-details.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 1, 1, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "model.errors.length", ["loc", [null, [1, 6], [1, 25]]]]], [], 0, null, ["loc", [null, [1, 0], [17, 7]]]], ["block", "each", [["get", "model.mixins", ["loc", [null, [18, 8], [18, 20]]]]], [], 1, null, ["loc", [null, [18, 0], [59, 9]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/components/mixin-property", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/mixin-property.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["inline", "yield", [["get", "this", ["loc", [null, [1, 8], [1, 12]]]]], [], ["loc", [null, [1, 0], [1, 14]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/not-detected", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 12,
              "column": 8
            },
            "end": {
              "line": 14,
              "column": 8
            }
          },
          "moduleName": "ember-inspector/templates/components/not-detected.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["content", "reasonsTitle", ["loc", [null, [13, 10], [13, 26]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 14,
              "column": 8
            },
            "end": {
              "line": 16,
              "column": 8
            }
          },
          "moduleName": "ember-inspector/templates/components/not-detected.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          Here are some common reasons this happens:\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 30,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/not-detected.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "error-page js-error-page");
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "error-page__content");
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "error-page__header");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4, "class", "error-page__title js-error-page-title");
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" not detected!");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "error-page__reasons");
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4, "class", "error-page__reasons-title");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4, "class", "error-page__list");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      If you're still having trouble, please file an issue on the Ember Inspector's\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "https://github.com/emberjs/ember-inspector");
        dom.setAttribute(el4, "target", "_blank");
        var el5 = dom.createTextNode("GitHub page.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0, 1]);
        var element1 = dom.childAt(element0, [3]);
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(dom.childAt(element0, [1, 1]), 0, 0);
        morphs[1] = dom.createMorphAt(dom.childAt(element1, [1]), 1, 1);
        morphs[2] = dom.createMorphAt(dom.childAt(element1, [3]), 1, 1);
        return morphs;
      },
      statements: [["content", "description", ["loc", [null, [6, 57], [6, 72]]]], ["block", "if", [["get", "reasonsTitle", ["loc", [null, [12, 14], [12, 26]]]]], [], 0, 1, ["loc", [null, [12, 8], [16, 15]]]], ["content", "yield", ["loc", [null, [20, 8], [20, 17]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/components/object-inspector", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 23,
                "column": 4
              },
              "end": {
                "line": 25,
                "column": 4
              }
            },
            "moduleName": "ember-inspector/templates/components/object-inspector.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("code");
            dom.setAttribute(el1, "class", "object-trail js-object-trail");
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
            return morphs;
          },
          statements: [["content", "trail", ["loc", [null, [24, 49], [24, 58]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 3,
              "column": 0
            },
            "end": {
              "line": 27,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/object-inspector.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "split__panel__hd");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "toolbar");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("button");
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el4 = dom.createElement("svg");
          dom.setAttribute(el4, "width", "9px");
          dom.setAttribute(el4, "height", "9px");
          dom.setAttribute(el4, "viewBox", "0 0 9 9");
          dom.setAttribute(el4, "version", "1.1");
          dom.setAttribute(el4, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el4, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          var el5 = dom.createTextNode("\n          ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("g");
          dom.setAttribute(el5, "stroke", "none");
          dom.setAttribute(el5, "stroke-width", "1");
          dom.setAttribute(el5, "fill", "none");
          dom.setAttribute(el5, "fill-rule", "evenodd");
          var el6 = dom.createTextNode("\n            ");
          dom.appendChild(el5, el6);
          var el6 = dom.createElement("polygon");
          dom.setAttribute(el6, "class", "svg-fill");
          dom.setAttribute(el6, "fill", "#000000");
          dom.setAttribute(el6, "transform", "translate(4.500000, 4.500000) rotate(-90.000000) translate(-4.500000, -4.500000) ");
          dom.setAttribute(el6, "points", "4.5 0 9 9 0 9 ");
          dom.appendChild(el5, el6);
          var el6 = dom.createTextNode("\n          ");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n        ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n      ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n      ");
          dom.appendChild(el2, el3);
          dom.setNamespace(null);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3, "class", "divider");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("code");
          dom.setAttribute(el3, "class", "toolbar__title js-object-name");
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("button");
          dom.setAttribute(el3, "class", "send-to-console js-send-object-to-console-btn");
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("img");
          dom.setAttribute(el4, "src", "assets/images/send.png");
          dom.setAttribute(el4, "title", "Send object to console");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n      ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var element1 = dom.childAt(element0, [1]);
          var element2 = dom.childAt(element1, [1]);
          var element3 = dom.childAt(element1, [7]);
          var morphs = new Array(5);
          morphs[0] = dom.createAttrMorph(element2, 'class');
          morphs[1] = dom.createElementMorph(element2);
          morphs[2] = dom.createMorphAt(dom.childAt(element1, [5]), 0, 0);
          morphs[3] = dom.createElementMorph(element3);
          morphs[4] = dom.createMorphAt(element0, 3, 3);
          return morphs;
        },
        statements: [["attribute", "class", ["concat", ["toolbar__icon-button ", ["subexpr", "if", [["get", "isNested", ["loc", [null, [6, 69], [6, 77]]]], "enabled", "disabled"], [], ["loc", [null, [6, 64], [6, 100]]]], " js-object-inspector-back"]]], ["element", "action", ["popStack"], [], ["loc", [null, [6, 14], [6, 35]]]], ["content", "model.firstObject.name", ["loc", [null, [16, 50], [16, 76]]]], ["element", "action", ["sendObjectToConsole", ["get", "model.firstObject", ["loc", [null, [18, 99], [18, 116]]]]], [], ["loc", [null, [18, 68], [18, 118]]]], ["block", "if", [["get", "trail", ["loc", [null, [23, 10], [23, 15]]]]], [], 0, null, ["loc", [null, [23, 4], [25, 11]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 32,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/object-inspector.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "split__panel__bd");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        morphs[2] = dom.createMorphAt(dom.childAt(fragment, [4]), 1, 1);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["inline", "sidebar-toggle", [], ["action", "toggleInspector", "side", "right", "isExpanded", true, "class", "toolbar__icon-button sidebar-toggle--far-left"], ["loc", [null, [1, 0], [2, 71]]]], ["block", "if", [["get", "model.length", ["loc", [null, [3, 6], [3, 18]]]]], [], 0, null, ["loc", [null, [3, 0], [27, 7]]]], ["inline", "mixin-details", [], ["model", ["subexpr", "@mut", [["get", "mixinDetails", ["loc", [null, [30, 24], [30, 36]]]]], [], []]], ["loc", [null, [30, 2], [30, 38]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/components/promise-item", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 8,
                "column": 4
              },
              "end": {
                "line": 12,
                "column": 4
              }
            },
            "moduleName": "ember-inspector/templates/components/promise-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "send-trace-to-console js-trace-promise-btn");
            dom.setAttribute(el1, "title", "Trace promise in console");
            var el2 = dom.createTextNode("\n        Trace\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element4 = dom.childAt(fragment, [1]);
            var morphs = new Array(1);
            morphs[0] = dom.createElementMorph(element4);
            return morphs;
          },
          statements: [["element", "action", [["get", "tracePromise", ["loc", [null, [9, 71], [9, 83]]]], ["get", "model", ["loc", [null, [9, 84], [9, 89]]]]], [], ["loc", [null, [9, 62], [9, 91]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["multiple-nodes"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 14,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/promise-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "list__cell-partial list__cell-partial_size_medium");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "js-promise-label");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("span");
          dom.setAttribute(el3, "class", "list__cell-arrow");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode(" ");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "list__cell-helper");
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element5 = dom.childAt(fragment, [1, 1]);
          var morphs = new Array(3);
          morphs[0] = dom.createAttrMorph(element5, 'title');
          morphs[1] = dom.createMorphAt(element5, 3, 3);
          morphs[2] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
          return morphs;
        },
        statements: [["attribute", "title", ["concat", [["get", "label", ["loc", [null, [3, 19], [3, 24]]]]]]], ["content", "label", ["loc", [null, [4, 45], [4, 54]]]], ["block", "if", [["get", "model.hasStack", ["loc", [null, [8, 10], [8, 24]]]]], [], 0, null, ["loc", [null, [8, 4], [12, 11]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 15,
              "column": 0
            },
            "end": {
              "line": 17,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/promise-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "pill pill_text_clear js-promise-state");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element3 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createAttrMorph(element3, 'style');
          morphs[1] = dom.createMorphAt(element3, 0, 0);
          return morphs;
        },
        statements: [["attribute", "style", ["get", "style", ["loc", [null, [16, 61], [16, 66]]]]], ["content", "state", ["loc", [null, [16, 69], [16, 78]]]]],
        locals: [],
        templates: []
      };
    })();
    var child2 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 21,
                  "column": 6
                },
                "end": {
                  "line": 23,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/promise-item.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "list__link js-promise-object-value");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element1 = dom.childAt(fragment, [1]);
              var morphs = new Array(2);
              morphs[0] = dom.createElementMorph(element1);
              morphs[1] = dom.createMorphAt(element1, 0, 0);
              return morphs;
            },
            statements: [["element", "action", [["get", "inspectObject", ["loc", [null, [22, 66], [22, 79]]]], ["get", "settledValue.objectId", ["loc", [null, [22, 80], [22, 101]]]]], [], ["loc", [null, [22, 57], [22, 103]]]], ["content", "settledValue.inspect", ["loc", [null, [22, 104], [22, 128]]]]],
            locals: [],
            templates: []
          };
        })();
        var child1 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 23,
                  "column": 6
                },
                "end": {
                  "line": 25,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/promise-item.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
              return morphs;
            },
            statements: [["content", "settledValue.inspect", ["loc", [null, [24, 8], [24, 32]]]]],
            locals: [],
            templates: []
          };
        })();
        var child2 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 28,
                  "column": 6
                },
                "end": {
                  "line": 32,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/promise-item.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("div");
              dom.setAttribute(el1, "class", "send-trace-to-console js-send-to-console-btn");
              dom.setAttribute(el1, "title", "Send stack trace to the console");
              var el2 = dom.createTextNode("\n          Stack trace\n        ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element0 = dom.childAt(fragment, [1]);
              var morphs = new Array(1);
              morphs[0] = dom.createElementMorph(element0);
              return morphs;
            },
            statements: [["element", "action", [["get", "sendValueToConsole", ["loc", [null, [29, 75], [29, 93]]]], ["get", "model", ["loc", [null, [29, 94], [29, 99]]]]], [], ["loc", [null, [29, 66], [29, 101]]]]],
            locals: [],
            templates: []
          };
        })();
        var child3 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 32,
                  "column": 6
                },
                "end": {
                  "line": 34,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/components/promise-item.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
              return morphs;
            },
            statements: [["inline", "send-to-console", [], ["action", ["subexpr", "@mut", [["get", "sendValueToConsole", ["loc", [null, [33, 33], [33, 51]]]]], [], []], "param", ["subexpr", "@mut", [["get", "model", ["loc", [null, [33, 58], [33, 63]]]]], [], []]], ["loc", [null, [33, 8], [33, 65]]]]],
            locals: [],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 19,
                "column": 2
              },
              "end": {
                "line": 36,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/promise-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-partial list__cell-partial_size_medium");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-helper");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element2 = dom.childAt(fragment, [1]);
            var morphs = new Array(3);
            morphs[0] = dom.createAttrMorph(element2, 'title');
            morphs[1] = dom.createMorphAt(element2, 1, 1);
            morphs[2] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
            return morphs;
          },
          statements: [["attribute", "title", ["concat", [["get", "settledValue.inspect", ["loc", [null, [20, 77], [20, 97]]]]]]], ["block", "if", [["get", "isValueInspectable", ["loc", [null, [21, 12], [21, 30]]]]], [], 0, 1, ["loc", [null, [21, 6], [25, 13]]]], ["block", "if", [["get", "isError", ["loc", [null, [28, 12], [28, 19]]]]], [], 2, 3, ["loc", [null, [28, 6], [34, 13]]]]],
          locals: [],
          templates: [child0, child1, child2, child3]
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 36,
                "column": 2
              },
              "end": {
                "line": 38,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/promise-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("  --\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 18,
              "column": 0
            },
            "end": {
              "line": 39,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/promise-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "hasValue", ["loc", [null, [19, 8], [19, 16]]]]], [], 0, 1, ["loc", [null, [19, 2], [38, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child3 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 40,
              "column": 0
            },
            "end": {
              "line": 42,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/promise-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["inline", "ms-to-time", [["get", "timeToSettle", ["loc", [null, [41, 15], [41, 27]]]]], [], ["loc", [null, [41, 2], [41, 29]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 43,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/promise-item.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(4);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 1, 1, contextualElement);
        morphs[2] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        morphs[3] = dom.createMorphAt(fragment, 3, 3, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "list.cell", [], ["class", ["subexpr", "concat", ["list__cell_main ", ["get", "expandedClass", ["loc", [null, [1, 46], [1, 59]]]]], [], ["loc", [null, [1, 19], [1, 60]]]], "style", ["subexpr", "@mut", [["get", "labelStyle", ["loc", [null, [1, 67], [1, 77]]]]], [], []], "on-click", ["subexpr", "action", [["get", "toggleExpand", ["loc", [null, [1, 95], [1, 107]]]], ["get", "model", ["loc", [null, [1, 108], [1, 113]]]]], [], ["loc", [null, [1, 87], [1, 114]]]]], 0, null, ["loc", [null, [1, 0], [14, 14]]]], ["block", "list.cell", [], [], 1, null, ["loc", [null, [15, 0], [17, 14]]]], ["block", "list.cell", [], ["class", "js-promise-value"], 2, null, ["loc", [null, [18, 0], [39, 14]]]], ["block", "list.cell", [], ["class", "list__cell list__cell_value_numeric js-promise-time"], 3, null, ["loc", [null, [40, 0], [42, 14]]]]],
      locals: [],
      templates: [child0, child1, child2, child3]
    };
  })());
});
define("ember-inspector/templates/components/property-field", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["empty-body"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 1,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/property-field.hbs"
      },
      isEmpty: true,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/record-filter", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/record-filter.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["inline", "yield", [["get", "this", ["loc", [null, [1, 8], [1, 12]]]]], [], ["loc", [null, [1, 0], [1, 14]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/record-item", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 4,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/record-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["content", "column.value", ["loc", [null, [3, 4], [3, 20]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 5,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/record-item.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "list.cell", [], ["class", "js-record-column", "clickable", true, "style", ["subexpr", "@mut", [["get", "style", ["loc", [null, [2, 61], [2, 66]]]]], [], []]], 0, null, ["loc", [null, [2, 2], [4, 16]]]]],
        locals: ["column"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/record-item.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "each", [["get", "columns", ["loc", [null, [1, 8], [1, 15]]]]], [], 0, null, ["loc", [null, [1, 0], [5, 9]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/components/reload-button", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 8,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/reload-button.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        dom.setNamespace("http://www.w3.org/2000/svg");
        var el1 = dom.createElement("svg");
        dom.setAttribute(el1, "version", "1.1");
        dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
        dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
        dom.setAttribute(el1, "x", "0px");
        dom.setAttribute(el1, "y", "0px");
        dom.setAttribute(el1, "width", "14px");
        dom.setAttribute(el1, "height", "14px");
        dom.setAttribute(el1, "viewBox", "0 0 54.203 55.142");
        dom.setAttribute(el1, "enable-background", "new 0 0 54.203 55.142");
        dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("path");
        dom.setAttribute(el2, "fill", "#797979");
        dom.setAttribute(el2, "d", "M54.203,21.472l-0.101-1.042h0.101c-0.042-0.159-0.101-0.311-0.146-0.468l-1.82-18.786l-6.056,6.055\n  C41.277,2.741,34.745,0,27.571,0C12.344,0,0,12.344,0,27.571s12.344,27.571,27.571,27.571c12.757,0,23.485-8.666,26.632-20.431\n  h-8.512c-2.851,7.228-9.881,12.349-18.12,12.349c-10.764,0-19.49-8.726-19.49-19.489s8.727-19.489,19.49-19.489\n  c4.942,0,9.441,1.853,12.873,4.887l-6.536,6.536L54.203,21.472z");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/render-item", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 8,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/components/render-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1, "class", "list__cell-arrow");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "js-render-profile-name");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "pill pill_not-clickable js-render-profile-duration");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [3]);
          var morphs = new Array(3);
          morphs[0] = dom.createAttrMorph(element0, 'title');
          morphs[1] = dom.createMorphAt(dom.childAt(element0, [1]), 0, 0);
          morphs[2] = dom.createMorphAt(dom.childAt(element0, [3]), 0, 0);
          return morphs;
        },
        statements: [["attribute", "title", ["concat", [["get", "model.name", ["loc", [null, [4, 19], [4, 29]]]]]]], ["content", "model.name", ["loc", [null, [5, 43], [5, 57]]]], ["inline", "ms-to-time", [["get", "model.duration", ["loc", [null, [6, 84], [6, 98]]]]], [], ["loc", [null, [6, 71], [6, 100]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 9,
              "column": 2
            },
            "end": {
              "line": 11,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/components/render-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["content", "readableTime", ["loc", [null, [10, 4], [10, 20]]]]],
        locals: [],
        templates: []
      };
    })();
    var child2 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 14,
                "column": 2
              },
              "end": {
                "line": 16,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/render-item.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["inline", "render-item", [], ["model", ["subexpr", "@mut", [["get", "child", ["loc", [null, [15, 24], [15, 29]]]]], [], []], "target", ["subexpr", "@mut", [["get", "this", ["loc", [null, [15, 37], [15, 41]]]]], [], []], "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [15, 47], [15, 51]]]]], [], []]], ["loc", [null, [15, 4], [15, 53]]]]],
          locals: ["child"],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 13,
              "column": 0
            },
            "end": {
              "line": 17,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/render-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "each", [["get", "model.children", ["loc", [null, [14, 10], [14, 24]]]]], [], 0, null, ["loc", [null, [14, 2], [16, 11]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["multiple-nodes", "wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 18,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/render-item.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("tr");
        dom.setAttribute(el1, "class", "list__row js-render-profile-item");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var morphs = new Array(4);
        morphs[0] = dom.createAttrMorph(element1, 'style');
        morphs[1] = dom.createMorphAt(element1, 1, 1);
        morphs[2] = dom.createMorphAt(element1, 2, 2);
        morphs[3] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["attribute", "style", ["get", "nodeStyle", ["loc", [null, [1, 12], [1, 21]]]]], ["block", "list.cell", [], ["class", ["subexpr", "concat", ["list__cell_main ", ["get", "expandedClass", ["loc", [null, [2, 48], [2, 61]]]], " js-render-main-cell"], [], ["loc", [null, [2, 21], [2, 85]]]], "on-click", ["subexpr", "action", ["toggleExpand"], [], ["loc", [null, [2, 95], [2, 118]]]], "style", ["subexpr", "@mut", [["get", "nameStyle", ["loc", [null, [2, 125], [2, 134]]]]], [], []]], 0, null, ["loc", [null, [2, 2], [8, 16]]]], ["block", "list.cell", [], ["class", "list__cell_value_numeric js-render-profile-timestamp"], 1, null, ["loc", [null, [9, 2], [11, 16]]]], ["block", "if", [["get", "isExpanded", ["loc", [null, [13, 6], [13, 16]]]]], [], 2, null, ["loc", [null, [13, 0], [17, 7]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("ember-inspector/templates/components/route-item", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 5,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/route-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "js-view-name");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element7 = dom.childAt(fragment, [1]);
          var element8 = dom.childAt(element7, [1]);
          var morphs = new Array(3);
          morphs[0] = dom.createAttrMorph(element7, 'style');
          morphs[1] = dom.createAttrMorph(element8, 'title');
          morphs[2] = dom.createMorphAt(element8, 0, 0);
          return morphs;
        },
        statements: [["attribute", "style", ["get", "labelStyle", ["loc", [null, [2, 15], [2, 25]]]]], ["attribute", "title", ["concat", [["get", "model.value.name", ["loc", [null, [3, 19], [3, 35]]]]]]], ["content", "model.value.name", ["loc", [null, [3, 60], [3, 80]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 6,
              "column": 0
            },
            "end": {
              "line": 13,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/route-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "list__cell-partial list__cell-partial_clickable js-route-handler");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "list__cell-helper");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element5 = dom.childAt(fragment, [1]);
          var element6 = dom.childAt(element5, [1]);
          var morphs = new Array(4);
          morphs[0] = dom.createElementMorph(element5);
          morphs[1] = dom.createAttrMorph(element6, 'title');
          morphs[2] = dom.createMorphAt(element6, 0, 0);
          morphs[3] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
          return morphs;
        },
        statements: [["element", "action", [["get", "inspectRoute", ["loc", [null, [7, 89], [7, 101]]]], ["get", "model.value.routeHandler.name", ["loc", [null, [7, 102], [7, 131]]]]], [], ["loc", [null, [7, 80], [7, 133]]]], ["attribute", "title", ["concat", [["get", "model.value.routeHandler.className", ["loc", [null, [8, 19], [8, 53]]]]]]], ["content", "model.value.routeHandler.className", ["loc", [null, [8, 57], [8, 95]]]], ["inline", "send-to-console", [], ["action", ["subexpr", "@mut", [["get", "sendRouteHandlerToConsole", ["loc", [null, [11, 29], [11, 54]]]]], [], []], "param", ["subexpr", "@mut", [["get", "model.value.routeHandler.name", ["loc", [null, [11, 61], [11, 90]]]]], [], []]], ["loc", [null, [11, 4], [11, 92]]]]],
        locals: [],
        templates: []
      };
    })();
    var child2 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 15,
                "column": 2
              },
              "end": {
                "line": 23,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/route-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-partial list__cell-partial_clickable js-route-controller");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-helper");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element3 = dom.childAt(fragment, [1]);
            var element4 = dom.childAt(element3, [1]);
            var morphs = new Array(4);
            morphs[0] = dom.createElementMorph(element3);
            morphs[1] = dom.createAttrMorph(element4, 'title');
            morphs[2] = dom.createMorphAt(element4, 0, 0);
            morphs[3] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
            return morphs;
          },
          statements: [["element", "action", [["get", "inspectController", ["loc", [null, [16, 94], [16, 111]]]], ["get", "model.value.controller", ["loc", [null, [16, 112], [16, 134]]]]], [], ["loc", [null, [16, 85], [16, 136]]]], ["attribute", "title", ["concat", [["get", "model.value.controller.className", ["loc", [null, [17, 21], [17, 53]]]]]]], ["content", "model.value.controller.className", ["loc", [null, [17, 57], [17, 93]]]], ["inline", "send-to-console", [], ["action", ["subexpr", "@mut", [["get", "sendControllerToConsole", ["loc", [null, [20, 31], [20, 54]]]]], [], []], "param", ["subexpr", "@mut", [["get", "model.value.controller.name", ["loc", [null, [20, 61], [20, 88]]]]], [], []]], ["loc", [null, [20, 6], [20, 90]]]]],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 23,
                "column": 2
              },
              "end": {
                "line": 27,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/route-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "js-route-controller");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element2 = dom.childAt(fragment, [1, 1]);
            var morphs = new Array(2);
            morphs[0] = dom.createAttrMorph(element2, 'title');
            morphs[1] = dom.createMorphAt(element2, 0, 0);
            return morphs;
          },
          statements: [["attribute", "title", ["concat", [["get", "model.value.controller.className", ["loc", [null, [25, 21], [25, 53]]]]]]], ["content", "model.value.controller.className", ["loc", [null, [25, 57], [25, 93]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 14,
              "column": 0
            },
            "end": {
              "line": 28,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/route-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "model.value.controller.exists", ["loc", [null, [15, 8], [15, 37]]]]], [], 0, 1, ["loc", [null, [15, 2], [27, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child3 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 29,
              "column": 0
            },
            "end": {
              "line": 31,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/route-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createAttrMorph(element1, 'title');
          morphs[1] = dom.createMorphAt(element1, 0, 0);
          return morphs;
        },
        statements: [["attribute", "title", ["concat", [["get", "model.value.template.name", ["loc", [null, [30, 17], [30, 42]]]]]]], ["content", "model.value.template.name", ["loc", [null, [30, 46], [30, 75]]]]],
        locals: [],
        templates: []
      };
    })();
    var child4 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 32,
              "column": 0
            },
            "end": {
              "line": 34,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/route-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createAttrMorph(element0, 'title');
          morphs[1] = dom.createMorphAt(element0, 0, 0);
          return morphs;
        },
        statements: [["attribute", "title", ["concat", [["get", "model.value.url", ["loc", [null, [33, 17], [33, 32]]]]]]], ["content", "model.value.url", ["loc", [null, [33, 36], [33, 55]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 35,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/route-item.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(5);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 1, 1, contextualElement);
        morphs[2] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        morphs[3] = dom.createMorphAt(fragment, 3, 3, contextualElement);
        morphs[4] = dom.createMorphAt(fragment, 4, 4, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "list.cell", [], ["class", "list__cell_main js-route-name", "highlight", ["subexpr", "@mut", [["get", "isCurrent", ["loc", [null, [1, 61], [1, 70]]]]], [], []]], 0, null, ["loc", [null, [1, 0], [5, 14]]]], ["block", "list.cell", [], [], 1, null, ["loc", [null, [6, 0], [13, 14]]]], ["block", "list.cell", [], [], 2, null, ["loc", [null, [14, 0], [28, 14]]]], ["block", "list.cell", [], ["class", "js-route-template"], 3, null, ["loc", [null, [29, 0], [31, 14]]]], ["block", "list.cell", [], ["class", "js-route-url"], 4, null, ["loc", [null, [32, 0], [34, 14]]]]],
      locals: [],
      templates: [child0, child1, child2, child3, child4]
    };
  })());
});
define("ember-inspector/templates/components/send-to-console", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/send-to-console.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("img");
        dom.setAttribute(el1, "src", "assets/images/send.png");
        dom.setAttribute(el1, "title", "Send to console");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/sidebar-toggle", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 11,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            dom.setNamespace("http://www.w3.org/2000/svg");
            var el1 = dom.createElement("svg");
            dom.setAttribute(el1, "width", "16px");
            dom.setAttribute(el1, "height", "14px");
            dom.setAttribute(el1, "viewBox", "0 0 16 14");
            dom.setAttribute(el1, "version", "1.1");
            dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
            dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("title");
            var el3 = dom.createTextNode("Collapse Right Sidebar");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("g");
            dom.setAttribute(el2, "id", "expand-sidebar-left");
            dom.setAttribute(el2, "stroke", "none");
            dom.setAttribute(el2, "fill", "none");
            dom.setAttribute(el2, "transform", "translate(0,1)");
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("rect");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.setAttribute(el3, "x", "0.5");
            dom.setAttribute(el3, "y", "0.5");
            dom.setAttribute(el3, "width", "14");
            dom.setAttribute(el3, "height", "12");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "shape-rendering", "crispEdges");
            dom.setAttribute(el3, "d", "M10.75,0 L10.75,12");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-fill");
            dom.setAttribute(el3, "d", "M6.25,4 L9.25,9.5 L3.25,9.5 L6.25,4 Z");
            dom.setAttribute(el3, "fill", "#000");
            dom.setAttribute(el3, "transform", "translate(6.250000, 6.500000) scale(-1, 1) rotate(-90.000000) translate(-6.250000, -6.500000) ");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n      ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 11,
                "column": 2
              },
              "end": {
                "line": 20,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            dom.setNamespace("http://www.w3.org/2000/svg");
            var el1 = dom.createElement("svg");
            dom.setAttribute(el1, "width", "16px");
            dom.setAttribute(el1, "height", "14px");
            dom.setAttribute(el1, "viewBox", "0 0 16 14");
            dom.setAttribute(el1, "version", "1.1");
            dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
            dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("title");
            var el3 = dom.createTextNode("Expand Right Sidebar");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("g");
            dom.setAttribute(el2, "id", "expand-sidebar-left");
            dom.setAttribute(el2, "stroke", "none");
            dom.setAttribute(el2, "fill", "none");
            dom.setAttribute(el2, "transform", "translate(0,1)");
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("rect");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.setAttribute(el3, "x", "0.5");
            dom.setAttribute(el3, "y", "0.5");
            dom.setAttribute(el3, "width", "14");
            dom.setAttribute(el3, "height", "12");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "shape-rendering", "crispEdges");
            dom.setAttribute(el3, "d", "M10.75,0 L10.75,12");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-fill");
            dom.setAttribute(el3, "d", "M5.25,4 L8.25,9.25 L2.25,9.25 L5.25,4 L5.25,4 Z");
            dom.setAttribute(el3, "fill", "#000000");
            dom.setAttribute(el3, "transform", "translate(5.250000, 6.500000) rotate(-90.000000) translate(-5.250000, -6.500000)");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n      ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 21,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "isExpanded", ["loc", [null, [2, 8], [2, 18]]]]], [], 0, 1, ["loc", [null, [2, 2], [20, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child1 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 22,
                "column": 2
              },
              "end": {
                "line": 31,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            dom.setNamespace("http://www.w3.org/2000/svg");
            var el1 = dom.createElement("svg");
            dom.setAttribute(el1, "width", "16px");
            dom.setAttribute(el1, "height", "14px");
            dom.setAttribute(el1, "viewBox", "0 0 16 14");
            dom.setAttribute(el1, "version", "1.1");
            dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
            dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("title");
            var el3 = dom.createTextNode("Collapse Left Sidebar");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("g");
            dom.setAttribute(el2, "id", "expand-sidebar-left");
            dom.setAttribute(el2, "stroke", "none");
            dom.setAttribute(el2, "fill", "none");
            dom.setAttribute(el2, "transform", "translate(8.000000, 8.000000) scale(-1, 1) translate(-8.000000, -7.000000)");
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("rect");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.setAttribute(el3, "x", "0.5");
            dom.setAttribute(el3, "y", "0.5");
            dom.setAttribute(el3, "width", "14");
            dom.setAttribute(el3, "height", "12");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "shape-rendering", "crispEdges");
            dom.setAttribute(el3, "d", "M10.5,0 L10.5,12");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-fill");
            dom.setAttribute(el3, "d", "M6.25,4 L9.25,9.5 L3.25,9.5 L6.25,4 Z");
            dom.setAttribute(el3, "fill", "#000");
            dom.setAttribute(el3, "transform", "translate(6.250000, 6.500000) scale(-1, 1) rotate(-90.000000) translate(-6.250000, -6.500000) ");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n      ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 31,
                "column": 2
              },
              "end": {
                "line": 40,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            dom.setNamespace("http://www.w3.org/2000/svg");
            var el1 = dom.createElement("svg");
            dom.setAttribute(el1, "width", "16px");
            dom.setAttribute(el1, "height", "14px");
            dom.setAttribute(el1, "viewBox", "0 0 16 14");
            dom.setAttribute(el1, "version", "1.1");
            dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
            dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("title");
            var el3 = dom.createTextNode("Expand Left Sidebar");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("g");
            dom.setAttribute(el2, "id", "expand-sidebar-left");
            dom.setAttribute(el2, "stroke", "none");
            dom.setAttribute(el2, "fill", "none");
            dom.setAttribute(el2, "transform", "translate(8.000000, 8.000000) scale(-1, 1) translate(-8.000000, -7.000000)");
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("rect");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.setAttribute(el3, "x", "0.5");
            dom.setAttribute(el3, "y", "0.5");
            dom.setAttribute(el3, "width", "14");
            dom.setAttribute(el3, "height", "12");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-stroke");
            dom.setAttribute(el3, "shape-rendering", "crispEdges");
            dom.setAttribute(el3, "d", "M10.5,0 L10.5,12");
            dom.setAttribute(el3, "stroke", "#000000");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("path");
            dom.setAttribute(el3, "class", "svg-fill");
            dom.setAttribute(el3, "d", "M5.25,4 L8.25,9.25 L2.25,9.25 L5.25,4 L5.25,4 Z");
            dom.setAttribute(el3, "fill", "#000000");
            dom.setAttribute(el3, "transform", "translate(5.250000, 6.500000) rotate(-90.000000) translate(-5.250000, -6.500000)");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n      ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 21,
              "column": 0
            },
            "end": {
              "line": 41,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "isExpanded", ["loc", [null, [22, 8], [22, 18]]]]], [], 0, 1, ["loc", [null, [22, 2], [40, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 41,
            "column": 7
          }
        },
        "moduleName": "ember-inspector/templates/components/sidebar-toggle.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "isRight", ["loc", [null, [1, 6], [1, 13]]]]], [], 0, 1, ["loc", [null, [1, 0], [41, 7]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/components/view-item", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 5,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/view-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2, "class", "js-view-name");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element7 = dom.childAt(fragment, [1]);
          var element8 = dom.childAt(element7, [1]);
          var morphs = new Array(3);
          morphs[0] = dom.createAttrMorph(element7, 'style');
          morphs[1] = dom.createAttrMorph(element8, 'title');
          morphs[2] = dom.createMorphAt(element8, 0, 0);
          return morphs;
        },
        statements: [["attribute", "style", ["get", "labelStyle", ["loc", [null, [2, 15], [2, 25]]]]], ["attribute", "title", ["concat", [["get", "model.value.name", ["loc", [null, [3, 19], [3, 35]]]]]]], ["content", "model.value.name", ["loc", [null, [3, 60], [3, 80]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 6,
              "column": 0
            },
            "end": {
              "line": 8,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/view-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element6 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createAttrMorph(element6, 'title');
          morphs[1] = dom.createMorphAt(element6, 0, 0);
          return morphs;
        },
        statements: [["attribute", "title", ["concat", [["get", "model.value.template", ["loc", [null, [7, 17], [7, 37]]]]]]], ["inline", "if", [["get", "hasTemplate", ["loc", [null, [7, 46], [7, 57]]]], ["get", "model.value.template", ["loc", [null, [7, 58], [7, 78]]]], "--"], [], ["loc", [null, [7, 41], [7, 85]]]]],
        locals: [],
        templates: []
      };
    })();
    var child2 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 11,
                "column": 2
              },
              "end": {
                "line": 18,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/view-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-helper");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element4 = dom.childAt(fragment, [1]);
            var element5 = dom.childAt(element4, [1]);
            var morphs = new Array(5);
            morphs[0] = dom.createAttrMorph(element4, 'class');
            morphs[1] = dom.createElementMorph(element4);
            morphs[2] = dom.createAttrMorph(element5, 'title');
            morphs[3] = dom.createMorphAt(element5, 0, 0);
            morphs[4] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
            return morphs;
          },
          statements: [["attribute", "class", ["concat", ["list__cell-partial ", ["subexpr", "if", [["get", "modelInspectable", ["loc", [null, [12, 40], [12, 56]]]], "list__cell-partial_clickable"], [], ["loc", [null, [12, 35], [12, 89]]]], " js-view-model-clickable"]]], ["element", "action", ["inspectModel", ["get", "model.value.model.objectId", ["loc", [null, [12, 139], [12, 165]]]]], [], ["loc", [null, [12, 115], [12, 167]]]], ["attribute", "title", ["concat", [["get", "model.value.model.completeName", ["loc", [null, [13, 21], [13, 51]]]]]]], ["content", "model.value.model.name", ["loc", [null, [13, 55], [13, 81]]]], ["inline", "send-to-console", [], ["action", ["subexpr", "@mut", [["get", "sendModelToConsole", ["loc", [null, [16, 31], [16, 49]]]]], [], []], "param", ["subexpr", "@mut", [["get", "model.value", ["loc", [null, [16, 56], [16, 67]]]]], [], []]], ["loc", [null, [16, 6], [16, 69]]]]],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 18,
                "column": 2
              },
              "end": {
                "line": 20,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/view-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    --\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 10,
              "column": 0
            },
            "end": {
              "line": 21,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/view-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "hasModel", ["loc", [null, [11, 8], [11, 16]]]]], [], 0, 1, ["loc", [null, [11, 2], [20, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child3 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 24,
                "column": 2
              },
              "end": {
                "line": 31,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/view-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-helper");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element2 = dom.childAt(fragment, [1]);
            var element3 = dom.childAt(element2, [1]);
            var morphs = new Array(5);
            morphs[0] = dom.createAttrMorph(element2, 'class');
            morphs[1] = dom.createElementMorph(element2);
            morphs[2] = dom.createAttrMorph(element3, 'title');
            morphs[3] = dom.createMorphAt(element3, 0, 0);
            morphs[4] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
            return morphs;
          },
          statements: [["attribute", "class", ["concat", ["list__cell-partial ", ["subexpr", "if", [["get", "hasController", ["loc", [null, [25, 40], [25, 53]]]], "list__cell-partial_clickable"], [], ["loc", [null, [25, 35], [25, 86]]]]]]], ["element", "action", [["get", "inspect", ["loc", [null, [25, 97], [25, 104]]]], ["get", "model.value.controller.objectId", ["loc", [null, [25, 105], [25, 136]]]]], [], ["loc", [null, [25, 88], [25, 138]]]], ["attribute", "title", ["concat", [["get", "model.value.controller.completeName", ["loc", [null, [26, 21], [26, 56]]]]]]], ["content", "model.value.controller.name", ["loc", [null, [26, 60], [26, 91]]]], ["inline", "send-to-console", [], ["action", ["subexpr", "@mut", [["get", "sendObjectToConsole", ["loc", [null, [29, 31], [29, 50]]]]], [], []], "param", ["subexpr", "@mut", [["get", "model.value.controller.objectId", ["loc", [null, [29, 57], [29, 88]]]]], [], []]], ["loc", [null, [29, 6], [29, 90]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 23,
              "column": 0
            },
            "end": {
              "line": 32,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/view-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "hasController", ["loc", [null, [24, 8], [24, 21]]]]], [], 0, null, ["loc", [null, [24, 2], [31, 9]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    var child4 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 35,
                "column": 2
              },
              "end": {
                "line": 42,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/view-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "list__cell-helper");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var element1 = dom.childAt(element0, [1]);
            var morphs = new Array(5);
            morphs[0] = dom.createAttrMorph(element0, 'class');
            morphs[1] = dom.createElementMorph(element0);
            morphs[2] = dom.createAttrMorph(element1, 'title');
            morphs[3] = dom.createMorphAt(element1, 0, 0);
            morphs[4] = dom.createMorphAt(dom.childAt(fragment, [3]), 1, 1);
            return morphs;
          },
          statements: [["attribute", "class", ["concat", ["list__cell-partial ", ["subexpr", "if", [["get", "hasView", ["loc", [null, [36, 40], [36, 47]]]], "list__cell-partial_clickable"], [], ["loc", [null, [36, 35], [36, 80]]]]]]], ["element", "action", ["inspectView"], [], ["loc", [null, [36, 82], [36, 106]]]], ["attribute", "title", ["concat", [["get", "model.value.completeViewClass", ["loc", [null, [37, 21], [37, 50]]]]]]], ["content", "model.value.viewClass", ["loc", [null, [37, 54], [37, 79]]]], ["inline", "send-to-console", [], ["action", ["subexpr", "@mut", [["get", "sendObjectToConsole", ["loc", [null, [40, 31], [40, 50]]]]], [], []], "param", ["subexpr", "@mut", [["get", "model.value.objectId", ["loc", [null, [40, 57], [40, 77]]]]], [], []]], ["loc", [null, [40, 6], [40, 79]]]]],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 42,
                "column": 2
              },
              "end": {
                "line": 44,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/view-item.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    --\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 34,
              "column": 0
            },
            "end": {
              "line": 45,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/view-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "hasView", ["loc", [null, [35, 8], [35, 15]]]]], [], 0, 1, ["loc", [null, [35, 2], [44, 9]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child5 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 47,
              "column": 0
            },
            "end": {
              "line": 49,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/view-item.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1, "class", "pill pill_not-clickable pill_size_small js-view-duration");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
          return morphs;
        },
        statements: [["inline", "ms-to-time", [["get", "model.value.duration", ["loc", [null, [48, 86], [48, 106]]]]], [], ["loc", [null, [48, 73], [48, 108]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 50,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/view-item.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(6);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 1, 1, contextualElement);
        morphs[2] = dom.createMorphAt(fragment, 3, 3, contextualElement);
        morphs[3] = dom.createMorphAt(fragment, 5, 5, contextualElement);
        morphs[4] = dom.createMorphAt(fragment, 7, 7, contextualElement);
        morphs[5] = dom.createMorphAt(fragment, 9, 9, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "list.cell", [], ["class", "list__cell_main"], 0, null, ["loc", [null, [1, 0], [5, 14]]]], ["block", "list.cell", [], ["class", "js-view-template", "clickable", ["subexpr", "@mut", [["get", "hasElement", ["loc", [null, [6, 48], [6, 58]]]]], [], []], "on-click", ["subexpr", "action", ["inspectElement"], [], ["loc", [null, [6, 68], [6, 93]]]]], 1, null, ["loc", [null, [6, 0], [8, 14]]]], ["block", "list.cell", [], ["class", "js-view-model"], 2, null, ["loc", [null, [10, 0], [21, 14]]]], ["block", "list.cell", [], ["class", "js-view-controller"], 3, null, ["loc", [null, [23, 0], [32, 14]]]], ["block", "list.cell", [], ["class", "js-view-class"], 4, null, ["loc", [null, [34, 0], [45, 14]]]], ["block", "list.cell", [], ["class", "list__cell_size_small list__cell_value_numeric"], 5, null, ["loc", [null, [47, 0], [49, 14]]]]],
      locals: [],
      templates: [child0, child1, child2, child3, child4, child5]
    };
  })());
});
define("ember-inspector/templates/components/x-list-cell", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/x-list-cell.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["content", "yield", ["loc", [null, [1, 0], [1, 9]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/components/x-list-content", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 6
            },
            "end": {
              "line": 6,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/components/x-list-content.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("col");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(1);
          morphs[0] = dom.createAttrMorph(element0, 'style');
          return morphs;
        },
        statements: [["attribute", "style", ["subexpr", "build-style", [], ["width", ["subexpr", "concat", [["get", "column.width", ["loc", [null, [5, 47], [5, 59]]]], "px"], [], ["loc", [null, [5, 39], [5, 65]]]]], ["loc", [null, [5, 19], [5, 67]]]]]],
        locals: ["column"],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 11,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/x-list-content.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "list__table-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("table");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("colgroup");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0, 1]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]), 1, 1);
        morphs[1] = dom.createMorphAt(element1, 3, 3);
        return morphs;
      },
      statements: [["block", "each", [["get", "columns", ["loc", [null, [4, 14], [4, 21]]]]], [], 0, null, ["loc", [null, [4, 6], [6, 15]]]], ["inline", "yield", [["subexpr", "hash", [], ["rowEvents", ["get", "rowEvents", ["loc", [null, [8, 28], [8, 37]]]]], ["loc", [null, [8, 12], [8, 38]]]]], [], ["loc", [null, [8, 4], [8, 40]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/components/x-list", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 6,
                "column": 10
              },
              "end": {
                "line": 8,
                "column": 10
              }
            },
            "moduleName": "ember-inspector/templates/components/x-list.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("            ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("col");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var morphs = new Array(1);
            morphs[0] = dom.createAttrMorph(element0, 'style');
            return morphs;
          },
          statements: [["attribute", "style", ["subexpr", "build-style", [], ["width", ["subexpr", "concat", [["get", "column.width", ["loc", [null, [7, 51], [7, 63]]]], "px"], [], ["loc", [null, [7, 43], [7, 69]]]]], ["loc", [null, [7, 23], [7, 71]]]]]],
          locals: ["column"],
          templates: []
        };
      })();
      var child1 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 13,
                  "column": 14
                },
                "end": {
                  "line": 13,
                  "column": 83
                }
              },
              "moduleName": "ember-inspector/templates/components/x-list.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
              dom.insertBoundary(fragment, 0);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [["content", "column.name", ["loc", [null, [13, 68], [13, 83]]]]],
            locals: [],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 12,
                "column": 12
              },
              "end": {
                "line": 14,
                "column": 12
              }
            },
            "moduleName": "ember-inspector/templates/components/x-list.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("              ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["block", "x-list-cell", [], ["tagName", "th", "class", "js-header-column"], 0, null, ["loc", [null, [13, 14], [13, 99]]]]],
          locals: ["column"],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "triple-curlies"
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 20,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/x-list.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "list__header");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "list__table-container");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("table");
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("colgroup");
          var el5 = dom.createTextNode("\n");
          dom.appendChild(el4, el5);
          var el5 = dom.createComment("");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("        ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("tbody");
          var el5 = dom.createTextNode("\n          ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("tr");
          dom.setAttribute(el5, "class", "list__row");
          var el6 = dom.createTextNode("\n");
          dom.appendChild(el5, el6);
          var el6 = dom.createComment("");
          dom.appendChild(el5, el6);
          var el6 = dom.createTextNode("          ");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n        ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n      ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [1, 1, 1]);
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]), 1, 1);
          morphs[1] = dom.createMorphAt(dom.childAt(element1, [3, 1]), 1, 1);
          return morphs;
        },
        statements: [["block", "each", [["get", "columns", ["loc", [null, [6, 18], [6, 25]]]]], ["key", "id"], 0, null, ["loc", [null, [6, 10], [8, 19]]]], ["block", "each", [["get", "columns", ["loc", [null, [12, 20], [12, 27]]]]], ["key", "id"], 1, null, ["loc", [null, [12, 12], [14, 21]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 22,
              "column": 0
            },
            "end": {
              "line": 30,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/x-list.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["inline", "yield", [["subexpr", "hash", [], ["cell", ["subexpr", "component", ["x-list-cell"], ["tagName", "td"], ["loc", [null, [25, 11], [25, 49]]]], "vertical-collection", ["subexpr", "component", ["vertical-collection"], ["defaultHeight", 30, "tagName", "tbody", "itemClassNames", ["subexpr", "concat", ["list__row js-", ["get", "name", ["loc", [null, [26, 131], [26, 135]]]], "-item ", ["get", "itemClass", ["loc", [null, [26, 145], [26, 154]]]]], [], ["loc", [null, [26, 107], [26, 155]]]], "containerSelector", ".js-list-content"], ["loc", [null, [26, 26], [26, 193]]]], "rowEvents", ["get", "content.rowEvents", ["loc", [null, [27, 16], [27, 33]]]]], ["loc", [null, [24, 4], [28, 5]]]]], [], ["loc", [null, [23, 2], [29, 4]]]]],
        locals: ["content"],
        templates: []
      };
    })();
    var child2 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 33,
                "column": 2
              },
              "end": {
                "line": 35,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/components/x-list.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["inline", "drag-handle", [], ["side", "left", "left", ["subexpr", "@mut", [["get", "column.left", ["loc", [null, [34, 35], [34, 46]]]]], [], []], "position", ["subexpr", "one-way", [["get", "column.width", ["loc", [null, [34, 65], [34, 77]]]]], [], ["loc", [null, [34, 56], [34, 78]]]], "minWidth", ["subexpr", "@mut", [["get", "minWidth", ["loc", [null, [34, 88], [34, 96]]]]], [], []], "maxWidth", ["subexpr", "@mut", [["get", "column.maxWidth", ["loc", [null, [34, 106], [34, 121]]]]], [], []], "on-drag", ["subexpr", "action", ["didResize", ["get", "column.id", ["loc", [null, [34, 150], [34, 159]]]]], [], ["loc", [null, [34, 130], [34, 160]]]], "faded", true], ["loc", [null, [34, 4], [34, 173]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 32,
              "column": 0
            },
            "end": {
              "line": 36,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/components/x-list.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "unless", [["subexpr", "eq", [["get", "column", ["loc", [null, [33, 16], [33, 22]]]], ["get", "columns.lastObject", ["loc", [null, [33, 23], [33, 41]]]]], [], ["loc", [null, [33, 12], [33, 42]]]]], [], 0, null, ["loc", [null, [33, 2], [35, 13]]]]],
        locals: ["column"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type", "multiple-nodes"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 37,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/components/x-list.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        morphs[1] = dom.createMorphAt(fragment, 2, 2, contextualElement);
        morphs[2] = dom.createMorphAt(fragment, 4, 4, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "schema.columns.length", ["loc", [null, [1, 6], [1, 27]]]]], [], 0, null, ["loc", [null, [1, 0], [20, 7]]]], ["block", "x-list-content", [], ["headerHeight", ["subexpr", "@mut", [["get", "headerHeight", ["loc", [null, [22, 31], [22, 43]]]]], [], []], "columns", ["subexpr", "@mut", [["get", "columns", ["loc", [null, [22, 52], [22, 59]]]]], [], []]], 1, null, ["loc", [null, [22, 0], [30, 19]]]], ["block", "each", [["get", "columns", ["loc", [null, [32, 8], [32, 15]]]]], ["key", "id"], 2, null, ["loc", [null, [32, 0], [36, 9]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("ember-inspector/templates/container-type-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 8,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/container-type-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__search toolbar__search--small js-container-instance-search");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0, 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]), 1, 1);
        return morphs;
      },
      statements: [["inline", "reload-button", [], ["action", "reload", "classNames", "toolbar__icon-button js-reload-container-btn"], ["loc", [null, [2, 2], [2, 93]]]], ["inline", "input", [], ["value", ["subexpr", "@mut", [["get", "searchVal", ["loc", [null, [5, 18], [5, 27]]]]], [], []], "placeholder", "Search"], ["loc", [null, [5, 4], [5, 50]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/container-type", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          var child0 = (function () {
            return {
              meta: {
                "fragmentReason": false,
                "revision": "Ember@2.6.2",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 4,
                    "column": 6
                  },
                  "end": {
                    "line": 6,
                    "column": 6
                  }
                },
                "moduleName": "ember-inspector/templates/container-type.hbs"
              },
              isEmpty: false,
              arity: 0,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("        ");
                dom.appendChild(el0, el1);
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                var morphs = new Array(1);
                morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
                return morphs;
              },
              statements: [["content", "content.name", ["loc", [null, [5, 8], [5, 24]]]]],
              locals: [],
              templates: []
            };
          })();
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 3,
                  "column": 4
                },
                "end": {
                  "line": 7,
                  "column": 4
                }
              },
              "moduleName": "ember-inspector/templates/container-type.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
              dom.insertBoundary(fragment, 0);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [["block", "list.cell", [], ["class", "list__cell_main", "clickable", ["subexpr", "@mut", [["get", "content.inspectable", ["loc", [null, [4, 53], [4, 72]]]]], [], []]], 0, null, ["loc", [null, [4, 6], [6, 20]]]]],
            locals: [],
            templates: [child0]
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 8,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/container-type.hbs"
          },
          isEmpty: false,
          arity: 2,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [["block", "container-instance", [], ["list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [3, 31], [3, 35]]]]], [], []], "index", ["subexpr", "@mut", [["get", "index", ["loc", [null, [3, 42], [3, 47]]]]], [], []], "on-click", ["subexpr", "action", ["inspectInstance", ["get", "content", ["loc", [null, [3, 83], [3, 90]]]]], [], ["loc", [null, [3, 57], [3, 91]]]]], 0, null, ["loc", [null, [3, 4], [7, 27]]]]],
          locals: ["content", "index"],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 9,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/container-type.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "list.vertical-collection", [], ["content", ["subexpr", "@mut", [["get", "filtered", ["loc", [null, [2, 38], [2, 46]]]]], [], []], "defaultHeight", 30, "itemClass", "js-instance-row"], 0, null, ["loc", [null, [2, 2], [8, 31]]]]],
        locals: ["list"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 10,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/container-type.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-list", [], ["name", "container-instance-list", "schema", ["subexpr", "hash", [], ["columns", null], ["loc", [null, [1, 48], [1, 67]]]], "headerHeight", 0], 0, null, ["loc", [null, [1, 0], [9, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/container-types", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 15,
                  "column": 12
                },
                "end": {
                  "line": 18,
                  "column": 12
                }
              },
              "moduleName": "ember-inspector/templates/container-types.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("              ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "js-container-type-name");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n              (");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "js-container-type-count");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode(")\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(2);
              morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
              morphs[1] = dom.createMorphAt(dom.childAt(fragment, [3]), 0, 0);
              return morphs;
            },
            statements: [["content", "containerType.name", ["loc", [null, [16, 51], [16, 73]]]], ["content", "containerType.count", ["loc", [null, [17, 53], [17, 76]]]]],
            locals: [],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 13,
                "column": 8
              },
              "end": {
                "line": 20,
                "column": 8
              }
            },
            "moduleName": "ember-inspector/templates/container-types.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("          ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("li");
            dom.setAttribute(el1, "class", "js-container-type");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("          ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
            return morphs;
          },
          statements: [["block", "link-to", ["container-type", ["get", "containerType.name", ["loc", [null, [15, 40], [15, 58]]]]], [], 0, null, ["loc", [null, [15, 12], [18, 24]]]]],
          locals: ["containerType"],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 3,
              "column": 2
            },
            "end": {
              "line": 23,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/container-types.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "split__panel__bd");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "nav__title");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("h3");
          var el4 = dom.createTextNode("Types");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("ul");
          var el3 = dom.createTextNode("\n");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1, 3]), 1, 1);
          return morphs;
        },
        statements: [["block", "each", [["get", "sorted", ["loc", [null, [13, 16], [13, 22]]]]], [], 0, null, ["loc", [null, [13, 8], [20, 17]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 31,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/container-types.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "split");
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "split__panel");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "split__panel__bd");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0, 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element0, [3, 1]), 1, 1);
        return morphs;
      },
      statements: [["block", "draggable-column", [], ["width", 180, "classes", "split__panel split__panel--sidebar-2 nav"], 0, null, ["loc", [null, [3, 2], [23, 23]]]], ["content", "outlet", ["loc", [null, [27, 6], [27, 16]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/container-types/index-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 4,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/container-types/index-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]), 1, 1);
        return morphs;
      },
      statements: [["inline", "reload-button", [], ["action", "reload", "classNames", "toolbar__icon-button js-reload-container-btn"], ["loc", [null, [2, 2], [2, 93]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/data", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/data.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [["content", "outlet", ["loc", [null, [1, 0], [1, 10]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/data/index", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 10,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/data/index.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          var el2 = dom.createTextNode("You are using an old version of Ember (< rc7).");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          var el2 = dom.createTextNode("You are using an old version of Ember Data (< 0.14).");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          var el2 = dom.createTextNode("You are using another persistence library, in which case:\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("ul");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("li");
          var el4 = dom.createTextNode("Make sure the library has a data adapter.");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 12,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/data/index.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "data-error-page-container");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]), 1, 1);
        return morphs;
      },
      statements: [["block", "not-detected", [], ["description", "Data adapter"], 0, null, ["loc", [null, [2, 2], [10, 19]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/deprecations-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 8,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/deprecations-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__search js-deprecations-search");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0, 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]), 1, 1);
        return morphs;
      },
      statements: [["inline", "clear-button", [], ["action", "clear", "classNames", "toolbar__icon-button js-clear-deprecations-btn"], ["loc", [null, [2, 2], [2, 93]]]], ["inline", "input", [], ["value", ["subexpr", "@mut", [["get", "searchVal", ["loc", [null, [5, 18], [5, 27]]]]], [], []], "placeholder", "Search"], ["loc", [null, [5, 4], [5, 50]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/deprecations", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 4,
                  "column": 6
                },
                "end": {
                  "line": 13,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/deprecations.hbs"
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
              return morphs;
            },
            statements: [["inline", "deprecation-item", [], ["model", ["subexpr", "@mut", [["get", "content", ["loc", [null, [6, 16], [6, 23]]]]], [], []], "openResource", ["subexpr", "action", ["openResource"], [], ["loc", [null, [7, 23], [7, 46]]]], "traceSource", ["subexpr", "action", ["traceSource"], [], ["loc", [null, [8, 22], [8, 44]]]], "traceDeprecations", ["subexpr", "action", ["traceDeprecations"], [], ["loc", [null, [9, 28], [9, 56]]]], "class", "deprecation-item", "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [11, 15], [11, 19]]]]], [], []]], ["loc", [null, [5, 8], [12, 10]]]]],
            locals: ["content"],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 15,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/deprecations.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("tbody");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
            return morphs;
          },
          statements: [["block", "each", [["get", "filtered", ["loc", [null, [4, 14], [4, 22]]]]], [], 0, null, ["loc", [null, [4, 6], [13, 15]]]]],
          locals: [],
          templates: [child0]
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 15,
                "column": 2
              },
              "end": {
                "line": 20,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/deprecations.hbs"
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1, "class", "notice js-page-refresh");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("p");
            var el3 = dom.createTextNode("No deprecations have been detected. Try reloading to catch the deprecations that were logged before you opened the inspector.");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("button");
            dom.setAttribute(el2, "class", "js-page-refresh-btn");
            var el3 = dom.createTextNode("Reload");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1, 3]);
            var morphs = new Array(1);
            morphs[0] = dom.createElementMorph(element0);
            return morphs;
          },
          statements: [["element", "action", ["refreshPage"], [], ["loc", [null, [18, 42], [18, 66]]]]],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 21,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/deprecations.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "if", [["get", "filtered.length", ["loc", [null, [2, 8], [2, 23]]]]], [], 0, 1, ["loc", [null, [2, 2], [20, 9]]]]],
        locals: ["list"],
        templates: [child0, child1]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 22,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/deprecations.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-list", [], ["name", "deprecation-list", "schema", ["subexpr", "hash", [], ["columns", null], ["loc", [null, [1, 41], [1, 60]]]], "headerHeight", 0, "class", "js-deprecations list_no-alternate-color"], 0, null, ["loc", [null, [1, 0], [21, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/info", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 5,
                  "column": 8
                },
                "end": {
                  "line": 7,
                  "column": 8
                }
              },
              "moduleName": "ember-inspector/templates/info.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("          ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "js-lib-name");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
              return morphs;
            },
            statements: [["content", "library.name", ["loc", [null, [6, 36], [6, 52]]]]],
            locals: [],
            templates: []
          };
        })();
        var child1 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 8,
                  "column": 8
                },
                "end": {
                  "line": 10,
                  "column": 8
                }
              },
              "moduleName": "ember-inspector/templates/info.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("          ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "js-lib-version");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
              return morphs;
            },
            statements: [["content", "library.version", ["loc", [null, [9, 39], [9, 58]]]]],
            locals: [],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 3,
                "column": 4
              },
              "end": {
                "line": 12,
                "column": 4
              }
            },
            "moduleName": "ember-inspector/templates/info.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("tr");
            dom.setAttribute(el1, "class", "list__row js-library-row");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var morphs = new Array(2);
            morphs[0] = dom.createMorphAt(element0, 1, 1);
            morphs[1] = dom.createMorphAt(element0, 2, 2);
            return morphs;
          },
          statements: [["block", "list.cell", [], ["class", "list__cell_main"], 0, null, ["loc", [null, [5, 8], [7, 22]]]], ["block", "list.cell", [], [], 1, null, ["loc", [null, [8, 8], [10, 22]]]]],
          locals: ["library"],
          templates: [child0, child1]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 14,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/info.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("tbody");
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
          return morphs;
        },
        statements: [["block", "each", [["get", "model", ["loc", [null, [3, 12], [3, 17]]]]], [], 0, null, ["loc", [null, [3, 4], [12, 13]]]]],
        locals: ["list"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 15,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/info.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-list", [], ["name", "info-list", "schema", ["subexpr", "schema-for", ["info-list"], [], ["loc", [null, [1, 34], [1, 58]]]]], 0, null, ["loc", [null, [1, 0], [14, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/loading", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["empty-body"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/loading.hbs"
      },
      isEmpty: true,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/model-types-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/model-types-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__checkbox js-filter-hide-empty-model-typess");
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "options-hideEmptyModelTypes");
        var el4 = dom.createTextNode("Hide Empty Model Types");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0, 1]), 1, 1);
        return morphs;
      },
      statements: [["inline", "input", [], ["type", "checkbox", "checked", ["subexpr", "@mut", [["get", "options.hideEmptyModelTypes", ["loc", [null, [3, 38], [3, 65]]]]], [], []], "id", "options-hideEmptyModelTypes"], ["loc", [null, [3, 6], [3, 100]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/model-types", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 8,
                  "column": 12
                },
                "end": {
                  "line": 11,
                  "column": 12
                }
              },
              "moduleName": "ember-inspector/templates/model-types.hbs"
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("              ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "js-model-type-name");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n              (");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("span");
              dom.setAttribute(el1, "class", "js-model-type-count");
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode(")\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(2);
              morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
              morphs[1] = dom.createMorphAt(dom.childAt(fragment, [3]), 0, 0);
              return morphs;
            },
            statements: [["content", "modelType.name", ["loc", [null, [9, 47], [9, 65]]]], ["content", "modelType.count", ["loc", [null, [10, 49], [10, 68]]]]],
            locals: [],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 6,
                "column": 8
              },
              "end": {
                "line": 13,
                "column": 8
              }
            },
            "moduleName": "ember-inspector/templates/model-types.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("          ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("li");
            dom.setAttribute(el1, "class", "js-model-type");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("          ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
            return morphs;
          },
          statements: [["block", "link-to", ["records", ["subexpr", "escape-url", [["get", "modelType.name", ["loc", [null, [8, 45], [8, 59]]]]], [], ["loc", [null, [8, 33], [8, 60]]]]], [], 0, null, ["loc", [null, [8, 12], [11, 24]]]]],
          locals: ["modelType"],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 16,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/model-types.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "split__panel__bd");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "nav__title");
          var el3 = dom.createElement("h3");
          var el4 = dom.createTextNode("Model Types");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("ul");
          var el3 = dom.createTextNode("\n");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1, 3]), 1, 1);
          return morphs;
        },
        statements: [["block", "each", [["get", "sorted", ["loc", [null, [6, 16], [6, 22]]]]], [], 0, null, ["loc", [null, [6, 8], [13, 17]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 24,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/model-types.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "split");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "split__panel");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "split__panel__bd");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0, 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element0, [3, 1]), 1, 1);
        return morphs;
      },
      statements: [["block", "draggable-column", [], ["width", ["subexpr", "@mut", [["get", "navWidth", ["loc", [null, [2, 28], [2, 36]]]]], [], []], "classes", "split__panel split__panel--sidebar-2 nav"], 0, null, ["loc", [null, [2, 2], [16, 23]]]], ["content", "outlet", ["loc", [null, [20, 6], [20, 16]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/nav", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 6
            },
            "end": {
              "line": 9,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        View Tree\n        ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "19px");
          dom.setAttribute(el1, "height", "19px");
          dom.setAttribute(el1, "viewBox", "0 0 19 19");
          dom.setAttribute(el1, "enable-background", "new 0 0 19 19");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("path");
          dom.setAttribute(el2, "fill", "#454545");
          dom.setAttribute(el2, "d", "M0,0v19h19V0H0z M6,17h-4V5h4V17z M17,17H7V5h10v12H17z M17,4H2V2h15V1z");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 12,
              "column": 6
            },
            "end": {
              "line": 18,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        Routes\n        ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "19px");
          dom.setAttribute(el1, "height", "19px");
          dom.setAttribute(el1, "viewBox", "0 0 19 19");
          dom.setAttribute(el1, "enable-background", "new 0 0 19 19");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("polygon");
          dom.setAttribute(el2, "fill", "#454545");
          dom.setAttribute(el2, "points", "0.591,17.012 2.36,17.012 6.841,2.086 5.07,2.086");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("path");
          dom.setAttribute(el2, "fill", "#454545");
          dom.setAttribute(el2, "d", "M18.117,8.495l0.292-1.494h-2.242l0.874-3.507h-1.544l-0.874,3.507h-1.88l0.874-3.507h-1.536l-0.883,3.507 H8.668L8.375,8.495h2.449l-0.616,2.474H7.875l-0.292,1.495h2.252l-0.883,3.515h1.544l0.874-3.515h1.888l-0.883,3.515h1.544 l0.874-3.515h2.53l0.303-1.495h-2.459l0.625-2.474H18.117z M14.249,8.495l-0.617,2.474h-1.888l0.625-2.474H14.249z");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    var child2 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 21,
              "column": 6
            },
            "end": {
              "line": 26,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        Data\n        ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "19px");
          dom.setAttribute(el1, "height", "19px");
          dom.setAttribute(el1, "viewBox", "0 0 19 19");
          dom.setAttribute(el1, "enable-background", "new 0 0 19 19");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("path");
          dom.setAttribute(el2, "d", "M9.5,0.001C3.907,0.001,0,1.507,0,3.663v11.675C0,17.494,3.907,19,9.5,19c5.594,0,9.5-1.506,9.5-3.662V3.663 C19,1.507,15.094,0.001,9.5,0.001z M9.5,5.669c-4.768,0-7.81-1.318-7.81-2.007c0-0.689,3.042-2.008,7.81-2.008 c4.769,0,7.81,1.318,7.81,2.008C17.31,4.352,14.269,5.669,9.5,5.669z M17.31,15.338c0,0.689-3.041,2.007-7.81,2.007 c-4.768,0-7.81-1.317-7.81-2.007V5.852C3.39,6.77,6.282,7.324,9.5,7.324c3.217,0,6.108-0.554,7.81-1.472V15.338z");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    var child3 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 29,
              "column": 6
            },
            "end": {
              "line": 50,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        Deprecations\n        ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "id", "Layer_1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "20");
          dom.setAttribute(el1, "height", "18");
          dom.setAttribute(el1, "viewBox", "0 0 20.565 18.33");
          dom.setAttribute(el1, "enable-background", "new 0 0 20.565 18.33");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("g");
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3, "d", "M19.58,18.33H0.985c-0.351,0-0.674-0.187-0.851-0.489c-0.177-0.303-0.179-0.677-0.006-0.982L9.426,0.463\n            c0.35-0.617,1.363-0.617,1.713,0l9.297,16.396c0.173,0.305,0.17,0.679-0.006,0.982S19.931,18.33,19.58,18.33z M2.676,16.36h15.213\n            L10.283,2.946L2.676,16.36z");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("g");
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("path");
          dom.setAttribute(el4, "fill-rule", "evenodd");
          dom.setAttribute(el4, "clip-rule", "evenodd");
          dom.setAttribute(el4, "d", "M11.265,8.038c-0.082,1.158-0.162,2.375-0.259,3.594\n              c-0.021,0.271-0.088,0.544-0.169,0.806c-0.079,0.257-0.266,0.358-0.553,0.358c-0.289,0-0.489-0.098-0.553-0.358\n              c-0.096-0.394-0.167-0.799-0.201-1.203c-0.088-1.068-0.159-2.138-0.22-3.208c-0.017-0.289-0.011-0.588,0.047-0.87\n              c0.084-0.409,0.486-0.673,0.933-0.67c0.439,0.003,0.812,0.27,0.924,0.667c0.024,0.08,0.045,0.163,0.049,0.245\n              C11.271,7.59,11.265,7.784,11.265,8.038z");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("path");
          dom.setAttribute(el4, "fill-rule", "evenodd");
          dom.setAttribute(el4, "clip-rule", "evenodd");
          dom.setAttribute(el4, "d", "M11.285,14.534c0.004,0.554-0.436,1.004-0.991,1.015\n              c-0.552,0.01-1.015-0.45-1.013-1.008c0.001-0.552,0.449-1.004,1-1.007C10.829,13.531,11.281,13.983,11.285,14.534z");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n          ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n\n        ");
          dom.appendChild(el0, el1);
          dom.setNamespace(null);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1, "class", "pill pill_not-clickable");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [3]), 0, 0);
          return morphs;
        },
        statements: [["content", "deprecationCount", ["loc", [null, [49, 46], [49, 66]]]]],
        locals: [],
        templates: []
      };
    })();
    var child4 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 53,
              "column": 6
            },
            "end": {
              "line": 60,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      Info\n      ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "width", "19");
          dom.setAttribute(el1, "height", "19");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("rect");
          dom.setAttribute(el2, "id", "svg_3");
          dom.setAttribute(el2, "height", "6.815");
          dom.setAttribute(el2, "width", "3.33");
          dom.setAttribute(el2, "fill", "#454545");
          dom.setAttribute(el2, "y", "7.8805");
          dom.setAttribute(el2, "x", "7.737");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("circle");
          dom.setAttribute(el2, "id", "svg_4");
          dom.setAttribute(el2, "r", "1.753");
          dom.setAttribute(el2, "cy", "5.3775");
          dom.setAttribute(el2, "cx", "9.451");
          dom.setAttribute(el2, "fill", "#454545");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("path");
          dom.setAttribute(el2, "id", "svg_6");
          dom.setAttribute(el2, "d", "m9.5,19c-5.238,0 -9.5,-4.262 -9.5,-9.5c0,-5.238 4.262,-9.5 9.5,-9.5s9.5,4.262 9.5,9.5c0,5.238 -4.262,9.5 -9.5,9.5zm0,-17.434c-4.375,0 -7.933,3.559 -7.933,7.933c0,4.374 3.559,7.932 7.933,7.932c4.374,0 7.933,-3.559 7.933,-7.932c0,-4.374 -3.559,-7.933 -7.933,-7.933z");
          dom.setAttribute(el2, "fill", "#454545");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    var child5 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 68,
              "column": 6
            },
            "end": {
              "line": 74,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        Promises\n        ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "23px");
          dom.setAttribute(el1, "height", "23px");
          dom.setAttribute(el1, "viewBox", "0 0 23 23");
          dom.setAttribute(el1, "enable-background", "new 0 0 23 23");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("path");
          dom.setAttribute(el2, "d", "M19,0 L19,19 L-0,19 L-0,0 z M2,2 L2,17 L17,17 L17,2.832 L6.807,12.912 L5.12,12.923 L5.12,2 z M7,2 L7.12,9.863 L15.953,2 z");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("path");
          dom.setAttribute(el2, "d", "M6.066,13.643 C4.488,13.643 3.208,12.363 3.208,10.784 C3.208,9.206 4.488,7.926 6.066,7.926 C7.645,7.926 8.925,9.206 8.925,10.784 C8.925,12.363 7.645,13.643 6.066,13.643 z");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    var child6 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 77,
              "column": 6
            },
            "end": {
              "line": 94,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      Container\n\n      ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "19px");
          dom.setAttribute(el1, "height", "19px");
          dom.setAttribute(el1, "viewBox", "0 0 43 42.191");
          dom.setAttribute(el1, "enable-background", "new 0 0 43 42.191");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("g");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3, "d", "M20.038,42.092L18,40.691V15.687l1.07-1.437l22-6.585L43,9.102v23.138l-0.962,1.4L20.038,42.092z M21,16.804v21.704\n          l19-7.299V11.116L21,16.804z");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3, "d", "M19.647,42.191c-0.224,0-0.452-0.05-0.666-0.156L0.833,33.028L0,31.685V8.01l2.075-1.386l18.507,7.677\n          c0.765,0.317,1.128,1.195,0.811,1.961c-0.318,0.765-1.195,1.129-1.96,0.811L3,10.256v20.499l17.315,8.593\n          c0.742,0.368,1.045,1.269,0.677,2.011C20.73,41.886,20.199,42.191,19.647,42.191z");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3, "d", "M41.414,10.602c-0.193,0-0.391-0.037-0.58-0.116L23.047,3.027L2.096,9.444C1.303,9.688,0.465,9.24,0.223,8.449\n          C-0.02,7.657,0.425,6.818,1.217,6.575L22.687,0l1.02,0.051l18.288,7.667c0.764,0.32,1.124,1.2,0.804,1.964\n          C42.557,10.256,42,10.602,41.414,10.602z");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    var child7 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 97,
              "column": 6
            },
            "end": {
              "line": 114,
              "column": 6
            }
          },
          "moduleName": "ember-inspector/templates/nav.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      Render Performance\n      ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1, "version", "1.1");
          dom.setAttribute(el1, "id", "Layer_1");
          dom.setAttribute(el1, "xmlns", "http://www.w3.org/2000/svg");
          dom.setAttribute(el1, "xmlns:xlink", "http://www.w3.org/1999/xlink");
          dom.setAttribute(el1, "x", "0px");
          dom.setAttribute(el1, "y", "0px");
          dom.setAttribute(el1, "width", "18.979px");
          dom.setAttribute(el1, "height", "18.979px");
          dom.setAttribute(el1, "viewBox", "0.021 -0.018 18.979 18.979");
          dom.setAttribute(el1, "enable-background", "new 0.021 -0.018 18.979 18.979");
          dom.setAttributeNS(el1, "http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("g");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3, "d", "M8.358,11.589c0.291,0.299,0.674,0.45,1.053,0.45c0.347,0,0.69-0.126,0.955-0.384c0.553-0.535,5.625-7.474,5.625-7.474\n          s-7.089,4.864-7.641,5.4C7.798,10.12,7.803,11.017,8.358,11.589z");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("g");
          var el4 = dom.createTextNode("\n          ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("path");
          dom.setAttribute(el4, "d", "M16.057,2.615c-1.702-1.627-4.005-2.633-6.546-2.633c-5.237,0-9.482,4.246-9.482,9.482c0,2.816,1.233,5.336,3.182,7.073\n            c-1.22-1.439-1.959-3.299-1.959-5.333c0-4.561,3.698-8.259,8.26-8.259c1.577,0,3.045,0.45,4.298,1.216\n            c0.561-0.386,1.067-0.734,1.472-1.011L16.057,2.615z");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n          ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("path");
          dom.setAttribute(el4, "d", "M17.005,4.923c-0.26,0.354-0.582,0.794-0.936,1.275c1.062,1.39,1.7,3.121,1.7,5.005c0,2.037-0.741,3.898-1.963,5.338\n            c1.951-1.736,3.187-4.259,3.187-7.078c0-1.905-0.568-3.676-1.535-5.162L17.005,4.923z");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 118,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/nav.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("nav");
        dom.setAttribute(el1, "class", "nav nav--main");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "nav__title nav__title--middle");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h3");
        var el4 = dom.createTextNode("Advanced");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [1]);
        var element2 = dom.childAt(element0, [5]);
        var morphs = new Array(8);
        morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]), 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element1, [3]), 1, 1);
        morphs[2] = dom.createMorphAt(dom.childAt(element1, [5]), 1, 1);
        morphs[3] = dom.createMorphAt(dom.childAt(element1, [7]), 1, 1);
        morphs[4] = dom.createMorphAt(dom.childAt(element1, [9]), 1, 1);
        morphs[5] = dom.createMorphAt(dom.childAt(element2, [1]), 1, 1);
        morphs[6] = dom.createMorphAt(dom.childAt(element2, [3]), 1, 1);
        morphs[7] = dom.createMorphAt(dom.childAt(element2, [5]), 1, 1);
        return morphs;
      },
      statements: [["block", "link-to", ["view-tree"], [], 0, null, ["loc", [null, [4, 6], [9, 18]]]], ["block", "link-to", ["route-tree"], [], 1, null, ["loc", [null, [12, 6], [18, 18]]]], ["block", "link-to", ["data"], [], 2, null, ["loc", [null, [21, 6], [26, 18]]]], ["block", "link-to", ["deprecations"], [], 3, null, ["loc", [null, [29, 6], [50, 18]]]], ["block", "link-to", ["info"], [], 4, null, ["loc", [null, [53, 6], [60, 18]]]], ["block", "link-to", ["promise-tree"], [], 5, null, ["loc", [null, [68, 6], [74, 18]]]], ["block", "link-to", ["container-types"], [], 6, null, ["loc", [null, [77, 6], [94, 18]]]], ["block", "link-to", ["render-tree"], [], 7, null, ["loc", [null, [97, 6], [114, 18]]]]],
      locals: [],
      templates: [child0, child1, child2, child3, child4, child5, child6, child7]
    };
  })());
});
define("ember-inspector/templates/page-refresh", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 5,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/page-refresh.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "notice js-page-refresh");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("Reload the page to see promises created before you opened the inspector.");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2, "class", "js-page-refresh-btn");
        var el3 = dom.createTextNode("Reload");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0, 3]);
        var morphs = new Array(1);
        morphs[0] = dom.createElementMorph(element0);
        return morphs;
      },
      statements: [["element", "action", ["refreshPage"], [], ["loc", [null, [3, 38], [3, 62]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/promise-tree-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 26,
              "column": 2
            },
            "end": {
              "line": 29,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/promise-tree-toolbar.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "divider");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1, "class", "js-toolbar-page-refresh-btn");
          var el2 = dom.createTextNode("Reload");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [3]);
          var morphs = new Array(1);
          morphs[0] = dom.createElementMorph(element0);
          return morphs;
        },
        statements: [["element", "action", ["refreshPage"], [], ["loc", [null, [28, 48], [28, 72]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 32,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/promise-tree-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__search js-promise-search");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("\n    All\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "divider");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("Rejected");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("Pending");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("Fulfilled");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "divider");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__checkbox js-with-stack");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "instrument-with-stack");
        var el4 = dom.createTextNode("Trace promises");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var element2 = dom.childAt(element1, [5]);
        var element3 = dom.childAt(element1, [9]);
        var element4 = dom.childAt(element1, [11]);
        var element5 = dom.childAt(element1, [13]);
        var morphs = new Array(12);
        morphs[0] = dom.createMorphAt(element1, 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element1, [3]), 1, 1);
        morphs[2] = dom.createAttrMorph(element2, 'class');
        morphs[3] = dom.createElementMorph(element2);
        morphs[4] = dom.createAttrMorph(element3, 'class');
        morphs[5] = dom.createElementMorph(element3);
        morphs[6] = dom.createAttrMorph(element4, 'class');
        morphs[7] = dom.createElementMorph(element4);
        morphs[8] = dom.createAttrMorph(element5, 'class');
        morphs[9] = dom.createElementMorph(element5);
        morphs[10] = dom.createMorphAt(dom.childAt(element1, [17]), 1, 1);
        morphs[11] = dom.createMorphAt(element1, 19, 19);
        return morphs;
      },
      statements: [["inline", "clear-button", [], ["action", "clear", "classNames", "toolbar__icon-button js-clear-promises-btn"], ["loc", [null, [2, 2], [2, 89]]]], ["inline", "input", [], ["value", ["subexpr", "@mut", [["get", "search", ["loc", [null, [5, 18], [5, 24]]]]], [], []], "placeholder", "Search"], ["loc", [null, [5, 4], [5, 47]]]], ["attribute", "class", ["concat", [["subexpr", "if", [["get", "noFilter", ["loc", [null, [8, 22], [8, 30]]]], "active"], [], ["loc", [null, [8, 17], [8, 41]]]], " toolbar__radio js-filter"]]], ["element", "action", ["setFilter", "all"], [], ["loc", [null, [8, 68], [8, 96]]]], ["attribute", "class", ["concat", [["subexpr", "if", [["get", "isRejectedFilter", ["loc", [null, [14, 22], [14, 38]]]], "active"], [], ["loc", [null, [14, 17], [14, 49]]]], " toolbar__radio js-filter"]]], ["element", "action", ["setFilter", "rejected"], [], ["loc", [null, [14, 76], [14, 109]]]], ["attribute", "class", ["concat", [["subexpr", "if", [["get", "isPendingFilter", ["loc", [null, [15, 22], [15, 37]]]], "active"], [], ["loc", [null, [15, 17], [15, 48]]]], " toolbar__radio js-filter"]]], ["element", "action", ["setFilter", "pending"], [], ["loc", [null, [15, 75], [15, 107]]]], ["attribute", "class", ["concat", [["subexpr", "if", [["get", "isFulfilledFilter", ["loc", [null, [16, 22], [16, 39]]]], "active"], [], ["loc", [null, [16, 17], [16, 50]]]], " toolbar__radio js-filter"]]], ["element", "action", ["setFilter", "fulfilled"], [], ["loc", [null, [16, 77], [16, 111]]]], ["inline", "action-checkbox", [], ["on-update", "updateInstrumentWithStack", "checked", ["subexpr", "@mut", [["get", "instrumentWithStack", ["loc", [null, [21, 68], [21, 87]]]]], [], []], "id", "instrument-with-stack"], ["loc", [null, [21, 4], [21, 116]]]], ["block", "unless", [["get", "shouldRefresh", ["loc", [null, [26, 12], [26, 25]]]]], [], 0, null, ["loc", [null, [26, 2], [29, 13]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/promise-tree", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 3,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/promise-tree.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          return morphs;
        },
        statements: [["inline", "partial", ["page_refresh"], [], ["loc", [null, [2, 2], [2, 28]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 5,
                  "column": 4
                },
                "end": {
                  "line": 16,
                  "column": 4
                }
              },
              "moduleName": "ember-inspector/templates/promise-tree.hbs"
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
              return morphs;
            },
            statements: [["inline", "promise-item", [], ["model", ["subexpr", "@mut", [["get", "content", ["loc", [null, [7, 14], [7, 21]]]]], [], []], "filter", ["subexpr", "@mut", [["get", "filter", ["loc", [null, [8, 15], [8, 21]]]]], [], []], "effectiveSearch", ["subexpr", "@mut", [["get", "effectiveSearch", ["loc", [null, [9, 24], [9, 39]]]]], [], []], "toggleExpand", ["subexpr", "action", ["toggleExpand"], [], ["loc", [null, [10, 21], [10, 44]]]], "tracePromise", ["subexpr", "action", ["tracePromise"], [], ["loc", [null, [11, 21], [11, 44]]]], "inspectObject", ["subexpr", "action", ["inspectObject"], [], ["loc", [null, [12, 22], [12, 46]]]], "sendValueToConsole", ["subexpr", "action", ["sendValueToConsole"], [], ["loc", [null, [13, 27], [13, 56]]]], "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [14, 13], [14, 17]]]]], [], []]], ["loc", [null, [6, 6], [15, 8]]]]],
            locals: ["content"],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 4,
                "column": 2
              },
              "end": {
                "line": 17,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/promise-tree.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [["block", "list.vertical-collection", [], ["content", ["subexpr", "@mut", [["get", "filtered", ["loc", [null, [5, 40], [5, 48]]]]], [], []]], 0, null, ["loc", [null, [5, 4], [16, 33]]]]],
          locals: ["list"],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 3,
              "column": 0
            },
            "end": {
              "line": 18,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/promise-tree.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "x-list", [], ["name", "promise-tree", "schema", ["subexpr", "schema-for", ["promise-tree"], [], ["loc", [null, [4, 39], [4, 66]]]], "class", "js-promise-tree"], 0, null, ["loc", [null, [4, 2], [17, 13]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 19,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/promise-tree.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "shouldRefresh", ["loc", [null, [1, 6], [1, 19]]]]], [], 0, 1, ["loc", [null, [1, 0], [18, 7]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/records-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 12,
                "column": 4
              },
              "end": {
                "line": 16,
                "column": 4
              }
            },
            "moduleName": "ember-inspector/templates/records-toolbar.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("button");
            var el2 = dom.createTextNode("\n        ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var morphs = new Array(3);
            morphs[0] = dom.createAttrMorph(element0, 'class');
            morphs[1] = dom.createElementMorph(element0);
            morphs[2] = dom.createMorphAt(element0, 1, 1);
            return morphs;
          },
          statements: [["attribute", "class", ["concat", [["subexpr", "if", [["get", "filter.checked", ["loc", [null, [13, 26], [13, 40]]]], "active"], [], ["loc", [null, [13, 21], [13, 51]]]], " toolbar__radio js-filter"]]], ["element", "action", ["setFilter", ["get", "filter.model.name", ["loc", [null, [13, 99], [13, 116]]]]], [], ["loc", [null, [13, 78], [13, 118]]]], ["content", "filter.model.desc", ["loc", [null, [14, 8], [14, 29]]]]],
          locals: ["filter"],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 11,
              "column": 2
            },
            "end": {
              "line": 17,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/records-toolbar.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "record-filter", [], ["model", ["subexpr", "@mut", [["get", "item", ["loc", [null, [12, 27], [12, 31]]]]], [], []], "filterValue", ["subexpr", "@mut", [["get", "filterValue", ["loc", [null, [12, 44], [12, 55]]]]], [], []]], 0, null, ["loc", [null, [12, 4], [16, 22]]]]],
        locals: ["item"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 19,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/records-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__search js-records-search");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("\n    All\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "divider");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var element2 = dom.childAt(element1, [3]);
        var morphs = new Array(4);
        morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]), 1, 1);
        morphs[1] = dom.createAttrMorph(element2, 'class');
        morphs[2] = dom.createElementMorph(element2);
        morphs[3] = dom.createMorphAt(element1, 7, 7);
        return morphs;
      },
      statements: [["inline", "input", [], ["value", ["subexpr", "@mut", [["get", "search", ["loc", [null, [3, 18], [3, 24]]]]], [], []], "placeholder", "Search"], ["loc", [null, [3, 4], [3, 47]]]], ["attribute", "class", ["concat", [["subexpr", "if", [["get", "noFilterValue", ["loc", [null, [6, 22], [6, 35]]]], "active"], [], ["loc", [null, [6, 17], [6, 46]]]], " toolbar__radio js-filter"]]], ["element", "action", ["setFilter"], [], ["loc", [null, [6, 73], [6, 95]]]], ["block", "each", [["get", "filters", ["loc", [null, [11, 10], [11, 17]]]]], [], 0, null, ["loc", [null, [11, 2], [17, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/records", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 7,
                "column": 2
              },
              "end": {
                "line": 15,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/records.hbs"
          },
          isEmpty: false,
          arity: 2,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["inline", "record-item", [], ["model", ["subexpr", "@mut", [["get", "content", ["loc", [null, [9, 12], [9, 19]]]]], [], []], "modelTypeColumns", ["subexpr", "@mut", [["get", "columns", ["loc", [null, [10, 23], [10, 30]]]]], [], []], "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [11, 11], [11, 15]]]]], [], []], "index", ["subexpr", "@mut", [["get", "index", ["loc", [null, [12, 12], [12, 17]]]]], [], []], "on-click", ["subexpr", "action", ["inspectModel", ["get", "content", ["loc", [null, [13, 38], [13, 45]]]]], [], ["loc", [null, [13, 15], [13, 46]]]]], ["loc", [null, [8, 4], [14, 6]]]]],
          locals: ["content", "index"],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 16,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/records.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "list.vertical-collection", [], ["content", ["subexpr", "@mut", [["get", "filtered", ["loc", [null, [7, 38], [7, 46]]]]], [], []]], 0, null, ["loc", [null, [7, 2], [15, 31]]]]],
        locals: ["list"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 17,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/records.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-list", [], ["name", "record-list", "schema", ["subexpr", "@mut", [["get", "schema", ["loc", [null, [3, 9], [3, 15]]]]], [], []], "storageKey", ["subexpr", "concat", ["record-list-", ["get", "modelType.name", ["loc", [null, [4, 36], [4, 50]]]]], [], ["loc", [null, [4, 13], [4, 51]]]], "itemClass", "list__row_highlight"], 0, null, ["loc", [null, [1, 0], [16, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/render-tree-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 8,
              "column": 2
            },
            "end": {
              "line": 11,
              "column": 2
            }
          },
          "moduleName": "ember-inspector/templates/render-tree-toolbar.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "divider");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1, "class", "js-toolbar-page-refresh-btn");
          var el2 = dom.createTextNode("Reload");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [3]);
          var morphs = new Array(1);
          morphs[0] = dom.createElementMorph(element0);
          return morphs;
        },
        statements: [["element", "action", ["refreshPage"], [], ["loc", [null, [10, 48], [10, 72]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 14,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/render-tree-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__search js-render-profiles-search");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "filter-bar__pills");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(element1, 1, 1);
        morphs[1] = dom.createMorphAt(dom.childAt(element1, [3]), 1, 1);
        morphs[2] = dom.createMorphAt(element1, 7, 7);
        return morphs;
      },
      statements: [["inline", "clear-button", [], ["action", "clearProfiles", "classNames", "toolbar__icon-button"], ["loc", [null, [2, 2], [2, 75]]]], ["inline", "input", [], ["value", ["subexpr", "@mut", [["get", "searchField", ["loc", [null, [4, 18], [4, 29]]]]], [], []], "placeholder", "Search"], ["loc", [null, [4, 4], [4, 52]]]], ["block", "unless", [["get", "showEmpty", ["loc", [null, [8, 12], [8, 21]]]]], [], 0, null, ["loc", [null, [8, 2], [11, 13]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/render-tree", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "fragmentReason": {
            "name": "triple-curlies"
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 7,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/render-tree.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "notice js-render-tree-empty");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("p");
          var el3 = dom.createTextNode("No rendering metrics have been collected. Try reloading or navigating around your application.");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("p");
          var el3 = dom.createElement("strong");
          var el4 = dom.createTextNode("Note:");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode(" Very fast rendering times (<1ms) are excluded.");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "js-toolbar-page-refresh-btn");
          var el3 = dom.createTextNode("Reload");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1, 5]);
          var morphs = new Array(1);
          morphs[0] = dom.createElementMorph(element0);
          return morphs;
        },
        statements: [["element", "action", ["refreshPage"], [], ["loc", [null, [5, 48], [5, 72]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      var child0 = (function () {
        var child0 = (function () {
          return {
            meta: {
              "fragmentReason": false,
              "revision": "Ember@2.6.2",
              "loc": {
                "source": null,
                "start": {
                  "line": 10,
                  "column": 6
                },
                "end": {
                  "line": 12,
                  "column": 6
                }
              },
              "moduleName": "ember-inspector/templates/render-tree.hbs"
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
              return morphs;
            },
            statements: [["inline", "render-item", [], ["model", ["subexpr", "@mut", [["get", "item", ["loc", [null, [11, 28], [11, 32]]]]], [], []], "search", ["subexpr", "@mut", [["get", "search", ["loc", [null, [11, 40], [11, 46]]]]], [], []], "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [11, 52], [11, 56]]]]], [], []]], ["loc", [null, [11, 8], [11, 58]]]]],
            locals: ["item"],
            templates: []
          };
        })();
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 8,
                "column": 2
              },
              "end": {
                "line": 14,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/render-tree.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("tbody");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
            return morphs;
          },
          statements: [["block", "each", [["get", "filtered", ["loc", [null, [10, 14], [10, 22]]]]], [], 0, null, ["loc", [null, [10, 6], [12, 15]]]]],
          locals: ["list"],
          templates: [child0]
        };
      })();
      return {
        meta: {
          "fragmentReason": false,
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 7,
              "column": 0
            },
            "end": {
              "line": 15,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/render-tree.hbs"
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "x-list", [], ["name", "render-tree", "schema", ["subexpr", "schema-for", ["render-tree"], [], ["loc", [null, [8, 38], [8, 64]]]], "class", "list_no-alternate-color js-render-tree"], 0, null, ["loc", [null, [8, 2], [14, 13]]]]],
        locals: [],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 16,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/render-tree.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "showEmpty", ["loc", [null, [1, 6], [1, 15]]]]], [], 0, 1, ["loc", [null, [1, 0], [15, 7]]]]],
      locals: [],
      templates: [child0, child1]
    };
  })());
});
define("ember-inspector/templates/route-tree-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/route-tree-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__checkbox js-filter-hide-routes");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "options-hideRoutes");
        var el4 = dom.createTextNode("Current Route only");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0, 1]), 1, 1);
        return morphs;
      },
      statements: [["inline", "input", [], ["type", "checkbox", "checked", ["subexpr", "@mut", [["get", "options.hideRoutes", ["loc", [null, [3, 36], [3, 54]]]]], [], []], "id", "options-hideRoutes"], ["loc", [null, [3, 4], [3, 80]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/route-tree", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 12,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/route-tree.hbs"
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["inline", "route-item", [], ["model", ["subexpr", "@mut", [["get", "content", ["loc", [null, [4, 12], [4, 19]]]]], [], []], "currentRoute", ["subexpr", "@mut", [["get", "currentRoute", ["loc", [null, [5, 19], [5, 31]]]]], [], []], "inspectRoute", ["subexpr", "action", ["inspectRoute"], [], ["loc", [null, [6, 19], [6, 42]]]], "sendRouteHandlerToConsole", ["subexpr", "action", ["sendRouteHandlerToConsole"], [], ["loc", [null, [7, 32], [7, 68]]]], "inspectController", ["subexpr", "action", ["inspectController"], [], ["loc", [null, [8, 24], [8, 52]]]], "sendControllerToConsole", ["subexpr", "action", ["sendControllerToConsole"], [], ["loc", [null, [9, 30], [9, 64]]]], "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [10, 11], [10, 15]]]]], [], []]], ["loc", [null, [3, 4], [11, 6]]]]],
          locals: ["content"],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 13,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/route-tree.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "list.vertical-collection", [], ["content", ["subexpr", "@mut", [["get", "filtered", ["loc", [null, [2, 38], [2, 46]]]]], [], []]], 0, null, ["loc", [null, [2, 2], [12, 31]]]]],
        locals: ["list"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 14,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/route-tree.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-list", [], ["name", "route-tree", "schema", ["subexpr", "schema-for", ["route-tree"], [], ["loc", [null, [1, 35], [1, 60]]]]], 0, null, ["loc", [null, [1, 0], [13, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("ember-inspector/templates/view-tree-toolbar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "fragmentReason": {
          "name": "triple-curlies"
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 17,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/view-tree-toolbar.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "toolbar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        dom.setNamespace("http://www.w3.org/2000/svg");
        var el3 = dom.createElement("svg");
        dom.setAttribute(el3, "width", "16px");
        dom.setAttribute(el3, "height", "16px");
        dom.setAttribute(el3, "viewBox", "0 0 16 16");
        dom.setAttribute(el3, "version", "1.1");
        dom.setAttribute(el3, "xmlns", "http://www.w3.org/2000/svg");
        dom.setAttribute(el3, "xmlns:xlink", "http://www.w3.org/1999/xlink");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("g");
        dom.setAttribute(el4, "class", "svg-stroke");
        dom.setAttribute(el4, "transform", "translate(3.000000, 4.000000)");
        dom.setAttribute(el4, "stroke", "#000000");
        dom.setAttribute(el4, "stroke-width", "2");
        dom.setAttribute(el4, "fill", "none");
        dom.setAttribute(el4, "fill-rule", "evenodd");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("path");
        dom.setAttribute(el5, "d", "M7.5,7.5 L10.5,10.5");
        dom.setAttribute(el5, "stroke-linecap", "square");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("circle");
        dom.setAttribute(el5, "cx", "4");
        dom.setAttribute(el5, "cy", "4");
        dom.setAttribute(el5, "r", "4");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        dom.setNamespace(null);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "divider");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "toolbar__checkbox js-filter-components");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "options-components");
        var el4 = dom.createTextNode("Components");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [1]);
        var morphs = new Array(3);
        morphs[0] = dom.createAttrMorph(element1, 'class');
        morphs[1] = dom.createElementMorph(element1);
        morphs[2] = dom.createMorphAt(dom.childAt(element0, [5]), 1, 1);
        return morphs;
      },
      statements: [["attribute", "class", ["concat", [["subexpr", "if", [["get", "inspectingViews", ["loc", [null, [2, 22], [2, 37]]]], "active"], [], ["loc", [null, [2, 17], [2, 48]]]], " toolbar__icon-button js-inspect-views"]]], ["element", "action", ["toggleViewInspection"], [], ["loc", [null, [2, 88], [2, 121]]]], ["inline", "input", [], ["type", "checkbox", "checked", ["subexpr", "@mut", [["get", "options.components", ["loc", [null, [14, 36], [14, 54]]]]], [], []], "id", "options-components"], ["loc", [null, [14, 4], [14, 80]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("ember-inspector/templates/view-tree", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "fragmentReason": false,
            "revision": "Ember@2.6.2",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 14,
                "column": 2
              }
            },
            "moduleName": "ember-inspector/templates/view-tree.hbs"
          },
          isEmpty: false,
          arity: 2,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
            return morphs;
          },
          statements: [["inline", "view-item", [], ["model", ["subexpr", "@mut", [["get", "content", ["loc", [null, [4, 14], [4, 21]]]]], [], []], "inspect", ["subexpr", "action", ["inspect"], [], ["loc", [null, [5, 16], [5, 34]]]], "inspectElement", ["subexpr", "action", ["inspectElement"], [], ["loc", [null, [6, 23], [6, 48]]]], "sendModelToConsole", ["subexpr", "action", ["sendModelToConsole"], [], ["loc", [null, [7, 27], [7, 56]]]], "sendObjectToConsole", ["subexpr", "action", ["sendObjectToConsole"], [], ["loc", [null, [8, 28], [8, 58]]]], "list", ["subexpr", "@mut", [["get", "list", ["loc", [null, [9, 13], [9, 17]]]]], [], []], "index", ["subexpr", "@mut", [["get", "index", ["loc", [null, [10, 14], [10, 19]]]]], [], []], "on-mouseenter", ["subexpr", "action", ["previewLayer", ["get", "content", ["loc", [null, [11, 45], [11, 52]]]]], [], ["loc", [null, [11, 22], [11, 53]]]], "on-mouseleave", ["subexpr", "action", ["hidePreview"], [], ["loc", [null, [12, 22], [12, 44]]]]], ["loc", [null, [3, 4], [13, 8]]]]],
          locals: ["content", "index"],
          templates: []
        };
      })();
      return {
        meta: {
          "fragmentReason": {
            "name": "missing-wrapper",
            "problems": ["wrong-type"]
          },
          "revision": "Ember@2.6.2",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 15,
              "column": 0
            }
          },
          "moduleName": "ember-inspector/templates/view-tree.hbs"
        },
        isEmpty: false,
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [["block", "list.vertical-collection", [], ["content", ["subexpr", "@mut", [["get", "model", ["loc", [null, [2, 38], [2, 43]]]]], [], []]], 0, null, ["loc", [null, [2, 2], [14, 31]]]]],
        locals: ["list"],
        templates: [child0]
      };
    })();
    return {
      meta: {
        "fragmentReason": {
          "name": "missing-wrapper",
          "problems": ["wrong-type"]
        },
        "revision": "Ember@2.6.2",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 16,
            "column": 0
          }
        },
        "moduleName": "ember-inspector/templates/view-tree.hbs"
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 0, 0, contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "x-list", [], ["name", "view-tree", "schema", ["subexpr", "schema-for", ["view-tree"], [], ["loc", [null, [1, 34], [1, 58]]]]], 0, null, ["loc", [null, [1, 0], [15, 11]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define('ember-inspector/utils/check-current-route', ['exports'], function (exports) {
  exports['default'] = function (currentRouteName, routeName) {
    var regName = undefined,
        match = undefined;

    if (routeName === 'application') {
      return true;
    }

    regName = routeName.replace('.', '\\.');
    match = currentRouteName.match(new RegExp('(^|\\.)' + regName + '(\\.|$)'));
    if (match && match[0].match(/^\.[^.]+$/)) {
      match = false;
    }
    return !!match;
  };
});
define("ember-inspector/utils/compare-arrays", ["exports"], function (exports) {
  exports["default"] = function (a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  };
});
define("ember-inspector/utils/escape-reg-exp", ["exports"], function (exports) {
  exports["default"] = function (str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };
});
define("ember-inspector/utils/search-match", ["exports", "ember", "ember-inspector/utils/escape-reg-exp"], function (exports, _ember, _emberInspectorUtilsEscapeRegExp) {
  var isEmpty = _ember["default"].isEmpty;

  exports["default"] = function (text, searchQuery) {
    if (isEmpty(searchQuery)) {
      return true;
    }
    var regExp = new RegExp((0, _emberInspectorUtilsEscapeRegExp["default"])(searchQuery.toLowerCase()));
    return !!text.toLowerCase().match(regExp);
  };
});


define('ember-inspector/config/environment', ['ember'], function(Ember) {
  var prefix = 'ember-inspector';
try {
  var metaName = prefix + '/config/environment';
  var rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
  var config = JSON.parse(unescape(rawConfig));

  var exports = { 'default': config };

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

});

if (!runningTests) {
  require("ember-inspector/app")["default"].create({"name":"ember-inspector","version":"2.0.5+892c13a3"});
}
