/**
 * Builds a Touch Portal .tpz2-compatible page bundle.
 *
 * Format confirmed from ReferenceOutput/extracted/ comparison:
 *   ZIP must contain: version.json + data.json + img/<pageId>.png
 *   data.json = {"pages":["<STRINGIFIED_PAGE_JSON>"],"flows":[],"values":[]}
 *   BUTTONS is always a fixed 15×15 grid; KEY_ROWS/KEY_COLUMNS define displayed size.
 *   Colors are signed 32-bit ARGB integers (alpha = 0xFF).
 *   Images are PNG files in img/ referenced by filename string in the `I` field.
 */

const KEY_ROWS    = 4;
const KEY_COLUMNS = 6;
const GRID_SIZE   = 15; // Touch Portal's fixed maximum grid dimension

/** Convert '#RRGGBB' hex to signed 32-bit ARGB integer (TP's color format). */
function hexToArgbInt(hex) {
  return (0xFF000000 | parseInt(hex.replace('#', ''), 16)) >> 0;
}

const BG_COLOR = hexToArgbInt('#0D0D1A');

/** Generate a TP-style unique ID: 'u' + 12 lowercase alphanumeric chars. */
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return 'u' + Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Build the full-page button object that covers KEY_ROWS × KEY_COLUMNS cells.
 * All field names and values are copied directly from the real TP reference export.
 */
function buildFullPageButton(imgFilename) {
  return {
    id:           generateId(),
    A:            [],
    BD:           1,
    BE:           BG_COLOR,
    BG:           BG_COLOR,
    BiR:          true,
    BiT:          true,
    C:            [],
    COLS:         KEY_COLUMNS,
    E:            [],
    FF:           'Default',
    GUdata:       '',
    GUid:         -1,
    I:            imgFilename,
    ITS:          true,
    IiS:          true,
    Ialt:         '',
    inB:          false,
    inC:          0,
    inS:          '',
    kCT:          1,
    kIAPBKC:      -14803426,
    kIAs:         [],
    kMB:          0,
    kML:          0,
    kMR:          0,
    kMT:          0,
    kSCAC:        BG_COLOR,
    kSCC:         -4611631,
    kSCI:         '',
    kSCHRC:       false,
    kSCHS:        false,
    kSCIIVA:      true,
    kSCIUFATS:    false,
    kSCM:         25,
    kSCTM:        0,
    kSCTY:        0,
    kSD:          0,
    kSIP:         0,
    kSTP:         0,
    kSVAC:        -10575407,
    kSVP:         0,
    kWvU:         '',
    kWvZ:         1,
    ROWS:         KEY_ROWS,
    T:            '',
    TA:           5,
    TC:           -1,
    TELS:         5,
    THO:          0,
    TO:           0,
    TP:           2,
    TS:           -1,
  };
}

/**
 * Build the 15×15 BUTTONS grid.
 * The spanning button sits at [0][0]; all other cells are empty objects {}.
 */
function buildButtonsGrid(imgFilename) {
  const emptyRow = () => Array.from({ length: GRID_SIZE }, () => ({}));
  const grid = Array.from({ length: GRID_SIZE }, emptyRow);
  grid[0][0] = buildFullPageButton(imgFilename);
  return grid;
}

/**
 * Build and return a Touch Portal page bundle from a page ID, title, and PNG screenshot.
 *
 * Returns:
 *   dataJson    — stringified data.json content for the ZIP
 *   imgFilename — filename to use inside img/ (e.g. "dashboard.png")
 *   imgBuffer   — the raw PNG Buffer (to write as img/<imgFilename>)
 */
export function buildPageBundle(pageId, pageTitle, pngBuffer) {
  const imgFilename = `${pageId}.png`;

  const pageObj = {
    kATO:        '',
    BG:          BG_COLOR,
    MAX:         false,
    BGI:         '',
    kPL:         0,
    kGB:         false,
    GUid:        -1,
    KEY_ID:      Date.now().toString(),
    kATY:        3,
    BUTTONS:     buildButtonsGrid(imgFilename),
    KEY_COLUMNS: KEY_COLUMNS,
    kFM:         0,
    kBN:         false,
    VERSION:     2,
    kENA:        0,
    GUdata:      '',
    KEY_TITLE:   pageTitle,
    KEY_ROWS:    KEY_ROWS,
    BTN_MARGIN:  0,
    PO:          1,
  };

  // TP stores each page as a JSON string inside the pages array
  const dataJson = JSON.stringify({
    pages:  [JSON.stringify(pageObj)],
    flows:  [],
    values: [],
  });

  return { dataJson, imgFilename, imgBuffer: pngBuffer };
}
