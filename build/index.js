'use strict';var _pify;
















function _load_pify() {return _pify = _interopRequireDefault(require('pify'));}var _run_test;
function _load_run_test() {return _run_test = _interopRequireDefault(require('./run_test'));}var _throat;
function _load_throat() {return _throat = _interopRequireDefault(require('throat'));}var _workerFarm;
function _load_workerFarm() {return _workerFarm = _interopRequireDefault(require('worker-farm'));}function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * This source code is licensed under the MIT license found in the
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * LICENSE file in the root directory of this source tree.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  */const TEST_WORKER_PATH = require.resolve('./test_worker');class TestRunner {constructor(globalConfig) {
    this._globalConfig = globalConfig;
  }

  runTests(
  tests,
  watcher,
  onStart,
  onResult,
  onFailure,
  options)
  {var _this = this;return _asyncToGenerator(function* () {
      return yield options.serial ?
      _this._createInBandTestRun(tests, watcher, onStart, onResult, onFailure) :
      _this._createParallelTestRun(
      tests,
      watcher,
      onStart,
      onResult,
      onFailure);})();

  }

  _createInBandTestRun(
  tests,
  watcher,
  onStart,
  onResult,
  onFailure)
  {var _this2 = this;return _asyncToGenerator(function* () {
      const mutex = (0, (_throat || _load_throat()).default)(1);
      return tests.reduce(
      function (promise, test) {return (
          mutex(function () {return (
              promise.
              then(_asyncToGenerator(function* () {
                if (watcher.isInterrupted()) {
                  throw new CancelRun();
                }

                yield onStart(test);
                return (0, (_run_test || _load_run_test()).default)(
                test.path,
                _this2._globalConfig,
                test.context.config,
                test.context.resolver);

              })).
              then(function (result) {return onResult(test, result);}).
              catch(function (err) {return onFailure(test, err);}));}));},

      Promise.resolve());})();

  }

  _createParallelTestRun(
  tests,
  watcher,
  onStart,
  onResult,
  onFailure)
  {var _this3 = this;return _asyncToGenerator(function* () {
      const farm = (0, (_workerFarm || _load_workerFarm()).default)(
      {
        autoStart: true,
        maxConcurrentCallsPerWorker: 1,
        maxConcurrentWorkers: _this3._globalConfig.maxWorkers,
        maxRetries: 2 // Allow for a couple of transient errors.
      },
      TEST_WORKER_PATH);

      const mutex = (0, (_throat || _load_throat()).default)(_this3._globalConfig.maxWorkers);
      const worker = (0, (_pify || _load_pify()).default)(farm);

      // Send test suites to workers continuously instead of all at once to track
      // the start time of individual tests.
      const runTestInWorker = function (test) {return (
          mutex(_asyncToGenerator(function* () {
            if (watcher.isInterrupted()) {
              return Promise.reject();
            }
            yield onStart(test);
            return worker({
              config: test.context.config,
              globalConfig: _this3._globalConfig,
              path: test.path,
              rawModuleMap: watcher.isWatchMode() ?
              test.context.moduleMap.getRawModuleMap() :
              null });

          })));};

      const onError = (() => {var _ref3 = _asyncToGenerator(function* (err, test) {
          yield onFailure(test, err);
          if (err.type === 'ProcessTerminatedError') {
            console.error(
            'A worker process has quit unexpectedly! ' +
            'Most likely this is an initialization error.');

            process.exit(1);
          }
        });return function onError(_x, _x2) {return _ref3.apply(this, arguments);};})();

      const onInterrupt = new Promise(function (_, reject) {
        watcher.on('change', function (state) {
          if (state.interrupted) {
            reject(new CancelRun());
          }
        });
      });

      const runAllTests = Promise.all(
      tests.map(function (test) {return (
          runTestInWorker(test).
          then(function (testResult) {return onResult(test, testResult);}).
          catch(function (error) {return onError(error, test);}));}));



      const cleanup = function () {return (_workerFarm || _load_workerFarm()).default.end(farm);};
      return Promise.race([runAllTests, onInterrupt]).then(cleanup, cleanup);})();
  }}


class CancelRun extends Error {
  constructor(message) {
    super(message);
    this.name = 'CancelRun';
  }}


module.exports = TestRunner;