const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = __dirname;
const ts = require(root + '/node_modules/typescript');
const source = fs.readFileSync(root + '/src/hooks/useWebSocket.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
async function scenario(withState) {
  let socket, connections = 0, received, timers = 0;
  class Socket {
    static OPEN = 1; static CONNECTING = 0;
    constructor() { socket = this; connections++; this.readyState = 1; this.sent = []; }
    send(data) { this.sent.push(data); }
    close() {}
  }
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => name === 'react' ? {
      useState: initial => [initial, () => {}], useRef: value => ({current: value}),
      useCallback: fn => fn, useEffect: fn => fn(),
    } : {getWsUrl: x => x},
    WebSocket: Socket, console: {log() {}, error() {}}, ArrayBuffer, Blob,
    setTimeout: () => { timers++; return 1; }, clearTimeout() {},
  });
  const hook = exports.default({serverUrl: 'wss://example.test/ws/patient', onFormCompleted: (text, state) => {received = {text, state};}});
  await hook.connect();
  assert.equal(hook.sendTextInput('before'), true);
  await socket.onmessage({data: JSON.stringify({type: 'form_completed', text: 'Read only', ...(withState ? {interview_state: {section: 'Referral', progress: 100, missing_fields: [], locked: false}} : {})})});
  assert.equal(received.text, 'Read only');
  assert.equal(received.state.locked, true);
  assert.equal(received.state.status, 'completed');
  for (const call of [() => hook.sendTextInput('hi'), () => hook.sendAudio(new ArrayBuffer(0)), () => hook.sendAudioStart(), () => hook.sendAudioEnd(1), () => hook.sendStartInterview('p'), () => hook.sendLoadForm('FRM-01')]) assert.equal(call(), false);
  assert.equal(socket.sent.length, 1);
  socket.onclose({code: 1006});
  assert.equal(timers, 0);
  await hook.connect();
  assert.equal(connections, 1);
}
(async () => {await scenario(true); await scenario(false); console.log('PASS: completion dispatch, forced lock, blocked inputs/start/load and no reconnect (with/without state)');})().catch(e => {console.error(e); process.exitCode = 1;});
