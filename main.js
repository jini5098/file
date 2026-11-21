// 동글 변환기 — 데스크톱(윈도우) 본체
// 트레이에 살면서: ① Alt+우클릭(도우미) ② 우클릭 메뉴 "동글로 변환" ③ Ctrl+Shift+D 로 파일을 받아 마우스 자리에 동글을 띄운다.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const TEST = !!process.env.DONGGEUL_TEST;
const WIN = process.platform === 'win32';
const REG_KEY = 'HKCU\\Software\\Classes\\*\\shell\\Donggeul';
let win = null, tray = null, helper = null, ready = false, visible = false;
let pending = [], pendTimer = null, shownAt = 0;
let cfg = { altClick: true, menu: true, firstRun: true };

const cfgPath = () => path.join(app.getPath('userData'), 'settings.json');
function loadCfg() { try { Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath(), 'utf8'))); } catch (e) {} }
function saveCfg() { try { fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(cfg)); } catch (e) {} }
const isFile = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
const fileArgs = argv => argv.slice(1).filter(a => a && !a.startsWith('-') && isFile(a)).map(a => path.resolve(a));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // 우클릭 메뉴로 여러 파일을 고르면 파일마다 한 번씩 실행된다 → 잠깐 모았다가 한 번에 띄운다
  app.on('second-instance', (e, argv) => addPaths(fileArgs(argv), 260));
  app.whenReady().then(init);
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { app.isQuitting = true; stopHelper(); });
}

function addPaths(list, wait) {
  for (const p of list) if (!pending.includes(p)) pending.push(p);
  if (!pending.length) return;
  clearTimeout(pendTimer);
  pendTimer = setTimeout(() => { const l = pending; pending = []; showRing(l); }, wait || 0);
}

function init() {
  loadCfg();
  win = new BrowserWindow({
    show: false, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, fullscreenable: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'ring.html'));
  win.webContents.once('did-finish-load', () => { ready = true; addPaths(fileArgs(process.argv), 200); });
  win.on('blur', () => { if (!TEST && Date.now() - shownAt > 400) hideRing(); });
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); hideRing(); } });

  ipcMain.handle('read', (e, p) => fs.promises.readFile(p));
  ipcMain.handle('save', (e, src, name, bytes) => saveNextTo(src, name, bytes));
  ipcMain.on('hide', hideRing);

  makeTray();
  if (WIN && app.isPackaged) {
    if (cfg.menu) registerMenu(true);
    if (cfg.altClick) startHelper();
    if (cfg.firstRun) {
      cfg.firstRun = false; saveCfg();
      try { tray.displayBalloon({ title: '동글 변환기가 켜졌어', content: '파일 위에서 Alt+우클릭, 또는 Shift+우클릭 → "동글로 변환"' }); } catch (e) {}
    }
  }
}

function showRing(paths) {
  if (!ready || !paths.length) return;
  const pt = screen.getCursorScreenPoint(), d = screen.getDisplayNearestPoint(pt), b = d.bounds;
  win.setBounds(b);
  const files = paths.map(p => { let size = 0; try { size = fs.statSync(p).size; } catch (e) {} return { path: p, name: path.basename(p), size }; });
  shownAt = Date.now(); visible = true;
  win.show(); win.focus();
  win.webContents.send('show', { x: pt.x - b.x, y: pt.y - b.y, w: b.width, h: b.height, files });
}
function hideRing() { if (!visible) return; visible = false; try { win.webContents.send('hidden'); win.hide(); } catch (e) {} }

async function saveNextTo(src, name, bytes) {
  const write = async dir => {
    const ext = path.extname(name), base = path.basename(name, ext);
    let out = path.join(dir, name), n = 2;
    while (fs.existsSync(out)) out = path.join(dir, base + ' (' + (n++) + ')' + ext);
    await fs.promises.writeFile(out, Buffer.from(bytes));
    return out;
  };
  try { return await write(path.dirname(src)); }
  catch (e) { return await write(app.getPath('downloads')); } // 원본 폴더에 못 쓰면 다운로드 폴더로
}

/* ---------- 트레이 ---------- */
function makeTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
    tray.setToolTip('동글 변환기');
    tray.on('click', pickFiles);
    refreshTray();
  } catch (e) {}
}
function refreshTray() {
  if (!tray) return;
  const login = WIN ? app.getLoginItemSettings().openAtLogin : false;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '파일 골라서 변환…', click: pickFiles },
    { type: 'separator' },
    { label: 'Alt+우클릭으로 동글 띄우기', type: 'checkbox', checked: cfg.altClick, enabled: WIN, click: m => { cfg.altClick = m.checked; saveCfg(); m.checked ? startHelper() : stopHelper(); } },
    { label: '우클릭 메뉴에 "동글로 변환" 넣기', type: 'checkbox', checked: cfg.menu, enabled: WIN, click: m => { cfg.menu = m.checked; saveCfg(); registerMenu(m.checked); } },
    { label: '윈도우 켤 때 같이 켜기', type: 'checkbox', checked: login, enabled: WIN, click: m => { app.setLoginItemSettings({ openAtLogin: m.checked }); } },
    { type: 'separator' },
    { label: '끝내기', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}
async function pickFiles() {
  const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], title: '바꿀 파일 고르기' });
  if (!r.canceled && r.filePaths.length) addPaths(r.filePaths, 0);
}

/* ---------- 우클릭 메뉴 (레지스트리, 현재 사용자만) ---------- */
function reg(args) { return new Promise(ok => execFile('reg', args, { windowsHide: true }, () => ok())); }
async function registerMenu(on) {
  if (!WIN) return;
  if (!on) { await reg(['delete', REG_KEY, '/f']); return; }
  const exe = process.execPath;
  await reg(['add', REG_KEY, '/ve', '/d', '동글로 변환', '/f']);
  await reg(['add', REG_KEY, '/v', 'Icon', '/d', exe + ',0', '/f']);
  await reg(['add', REG_KEY, '/v', 'Position', '/d', 'Top', '/f']);
  await reg(['add', REG_KEY + '\\command', '/ve', '/d', '"' + exe + '" "%1"', '/f']);
}

/* ---------- Alt+우클릭 도우미 (AutoHotkey) ---------- */
function startHelper() {
  if (!WIN || helper) return;
  const dir = path.join(app.isPackaged ? process.resourcesPath : __dirname, 'helper');
  const exe = path.join(dir, 'AutoHotkey64.exe'), script = path.join(dir, 'donggeul.ahk');
  if (!fs.existsSync(exe) || !fs.existsSync(script)) return;
  try {
    helper = spawn(exe, ['/ErrorStdOut', script], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let buf = '';
    helper.stdout.setEncoding('utf8');
    helper.stdout.on('data', s => {
      buf += s; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/^﻿/, '').replace(/\r$/, ''); buf = buf.slice(i + 1);
        const parts = line.split('\t');
        if (parts[0] === 'RING') addPaths(parts.slice(1).filter(isFile), 0);
      }
    });
    helper.on('exit', () => { helper = null; });
  } catch (e) { helper = null; }
}
function stopHelper() { if (helper) { try { helper.kill(); } catch (e) {} helper = null; } }
