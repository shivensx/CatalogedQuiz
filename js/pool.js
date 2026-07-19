  // ---------------- POOL MANAGEMENT ----------------
  const imageCache = new Map(); // key -> Image element, primes the browser cache ahead of use

  function preloadArt(item){
    if(imageCache.has(item.key)) return;
    const img = new Image();
    img.src = item.img;
    imageCache.set(item.key, img);
  }

  function isPreloaded(item){
    const img = imageCache.get(item.key);
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  // Prefer an artwork whose image is already cached, so the round can
  // render (and, in Time Attack, start its timer) without waiting on
  // a network fetch. Falls back to any candidate if nothing is ready yet.
  //
  // Picks are stratified by era first, then by artwork within that era.
  // A flat random pick across the whole pool would be dominated by
  // whichever movements happen to have the most public-domain hits
  // (Impressionism, Baroque, etc.), crowding out rarer ones like
  // Ukiyo-e or Neoclassicism. Picking the era uniformly first keeps
  // the mix of movements roughly even over time regardless of how
  // lopsided the underlying pool is.
  function pickForRound(candidates){
    const usable = candidates.filter(a => !state.brokenKeys.has(a.key));
    const pool = usable.length ? usable : candidates;
    const byEra = {};
    pool.forEach(a => { (byEra[a.era] = byEra[a.era] || []).push(a); });
    const eras = Object.keys(byEra);
    const era = pickRandom(eras);
    const group = byEra[era];
    const ready = group.filter(isPreloaded);
    return ready.length ? pickRandom(ready) : pickRandom(group);
  }

  function addToPool(items){
    if(!items || !items.length) return;
    const existing = new Set(state.pool.map(a => a.key));
    items.forEach(a => {
      if(!existing.has(a.key)){
        state.pool.push(a);
        existing.add(a.key);
        preloadArt(a);
      }
    });
  }

  function topUpIfLow(){
    const remaining = state.pool.length - state.usedKeys.size;
    if(remaining < 8){
      const term = TERMS[state.termCursor % TERMS.length];
      state.termCursor++;
      fetchAIC(term).then(addToPool);
      fetchCleveland(term).then(addToPool);
      fetchMet(term).then(addToPool);
      fetchSMK(term).then(addToPool);
      fetchEuropeana(term).then(addToPool);
      fetchSmithsonian(term).then(addToPool);
    }
  }

  // ---------------- SCREEN: LANDING ----------------
  // Full icon + wordmark lockup, used only on the home page hero.
  const HERO_LOGO_SVG = `<svg fill="currentColor" width="100%" height="100%" viewBox="0 0 993 463" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-miterlimit:1.5;">
    <g transform="matrix(1,0,0,1,-91.044503,-80.958167)">
        <g id="final-logo" serif:id="final logo" transform="matrix(1,0,0,1,-745.357335,-449.471129)">
            <g transform="matrix(0.784903,0,0,0.784903,-132.000395,201.952767)">
                <path d="M1313.611,821.433C1323.747,821.433 1333.318,827.547 1340.918,838.428C1351.238,853.205 1358.078,877.017 1358.078,903.898C1358.078,930.78 1351.238,954.592 1340.918,969.368C1333.318,980.249 1323.747,986.363 1313.611,986.363C1303.475,986.363 1293.903,980.249 1286.304,969.368C1275.984,954.592 1269.144,930.78 1269.144,903.898C1269.144,877.017 1275.984,853.205 1286.304,838.428C1293.903,827.547 1303.475,821.433 1313.611,821.433ZM1313.611,826.02C1291.6,826.02 1273.73,860.916 1273.73,903.898C1273.73,946.88 1291.6,981.777 1313.611,981.777C1335.621,981.777 1353.491,946.88 1353.491,903.898C1353.491,860.916 1335.621,826.02 1313.611,826.02Z"/>
                <g transform="matrix(1.136367,0,0,1,-59.659282,21.555607)">
                    <path d="M1347.285,862.18C1350.376,871.669 1352.445,882.551 1353.186,894.232C1353.364,897.021 1353.465,899.854 1353.487,902.726C1353.49,903.116 1353.491,903.507 1353.491,903.898C1353.491,946.88 1335.621,981.777 1313.611,981.777C1291.6,981.777 1273.73,946.88 1273.73,903.898C1273.73,889.008 1275.875,875.089 1279.593,863.254C1280.191,861.352 1280.829,859.503 1281.506,857.713" style="fill:none;stroke:currentColor;stroke-width:4.29px;"/>
                </g>
                <g transform="matrix(1.12312,-0.173011,0.152249,0.988342,-13.555193,213.470084)">
                    <path d="M1357.114,915.329C1355.38,939.12 1348.277,959.577 1338.409,972.177C1331.3,981.254 1322.731,986.363 1313.611,986.363C1304.986,986.363 1296.859,981.799 1289.989,973.627C1280.452,962.283 1273.292,943.783 1270.731,921.907C1270.078,916.334 1269.722,910.542 1269.696,904.592L1269.694,903.904L1269.694,903.898C1269.694,898.713 1269.946,893.642 1270.426,888.728L1270.725,885.666L1273.334,884.823C1281.14,882.301 1291.52,877.995 1304.478,871.919L1307.642,870.436L1309.447,873.74C1315.322,884.493 1321.322,892.414 1327.528,897.431C1334.659,903.195 1343.508,907.536 1354.06,910.498L1357.398,911.435L1357.114,915.329ZM1353.092,914.95C1341.989,911.834 1332.692,907.233 1325.188,901.168C1318.625,895.863 1312.231,887.532 1306.018,876.159C1292.879,882.319 1282.352,886.677 1274.438,889.235C1273.973,893.984 1273.73,898.886 1273.73,903.898L1273.732,904.575C1273.757,910.319 1274.101,915.917 1274.732,921.302C1278.785,955.918 1294.663,981.777 1313.611,981.777C1333.7,981.777 1350.34,952.706 1353.092,914.95Z"/>
                </g>
                <g transform="matrix(0.512437,0.222917,-0.398905,0.916992,913.288587,-282.72639)">
                    <path d="M1413.355,502.546C1416.974,489.497 1425.837,478.579 1437.273,471.888C1445.976,466.796 1456.232,464.028 1467.035,464.028C1479.82,464.028 1491.896,467.934 1501.481,474.962C1514.087,484.205 1522.526,499.082 1522.526,515.897C1522.526,532.712 1514.087,547.59 1501.481,556.833C1491.896,563.861 1479.82,567.767 1467.035,567.767C1449.308,567.767 1432.709,560.01 1422.475,547.113L1418.981,542.709L1427.023,540.975C1427.478,540.877 1427.932,540.773 1428.385,540.663C1435.386,538.961 1440.243,536.111 1442.961,532.117C1445.731,528.044 1445.382,523.883 1442.071,519.63C1437.866,514.227 1429.826,510.232 1418.242,507.467L1412.379,506.067L1413.355,502.546ZM1421.466,503.249C1435.225,506.533 1444.602,511.384 1449.597,517.8C1453.825,523.231 1454.17,528.547 1450.633,533.746C1447.095,538.946 1440.771,542.653 1431.659,544.868C1431.1,545.004 1430.539,545.133 1429.978,545.254C1438.643,556.173 1452.027,563.181 1467.035,563.181C1493.132,563.181 1514.319,541.994 1514.319,515.897C1514.319,489.801 1493.132,468.614 1467.035,468.614C1445.319,468.614 1427.003,483.286 1421.466,503.249Z"/>
                </g>
                <g transform="matrix(0.311573,-0.170242,0.283815,0.519431,690.126549,473.307591)">
                    <path d="M1426.565,540.348C1422.242,533.212 1419.752,524.843 1419.752,515.897C1419.752,489.801 1440.939,468.614 1467.035,468.614C1493.132,468.614 1514.319,489.801 1514.319,515.897C1514.319,523.612 1512.467,530.898 1509.184,537.335" style="fill:none;stroke:currentColor;stroke-width:9.4px;"/>
                </g>
                <g transform="matrix(1,0,0,1,-39.982174,-31.290397)">
                    <path d="M1489.558,732.61C1501.864,751.675 1509.044,774.599 1509.044,799.249C1509.044,801.405 1508.989,803.548 1508.881,805.676M1455.842,900.224C1449.786,904.264 1443.343,907.734 1436.585,910.559C1434.526,911.42 1432.437,912.221 1430.322,912.96C1418.747,917.004 1406.355,919.196 1393.473,919.196C1393.192,919.196 1392.911,919.195 1392.63,919.193C1365.232,918.989 1340.089,908.87 1320.368,892.124C1294.454,870.121 1277.902,836.675 1277.902,799.249C1277.902,765.278 1291.539,734.587 1313.436,712.755C1314.079,712.113 1314.73,711.479 1315.388,710.853M1489.558,732.61C1501.864,751.675 1509.044,774.599 1509.044,799.249C1509.044,801.405 1508.989,803.548 1508.881,805.676" style="fill:none;stroke:currentColor;stroke-width:4.59px;"/>
                </g>
                <g transform="matrix(1,0,0,1,10.610073,312.997156)">
                    <path d="M1262.844,368.467C1244.022,347.14 1234.611,320.604 1234.611,288.859C1234.611,272.57 1237.48,256.468 1243.218,240.55C1248.956,224.632 1256.822,211.027 1266.817,199.737C1268.744,197.525 1270.746,195.403 1272.821,193.369C1280.669,185.68 1289.576,179.263 1299.544,174.118C1302.384,172.652 1305.311,171.289 1308.324,170.03C1324.705,163.181 1342.612,159.757 1362.047,159.757C1388.885,159.757 1409.893,165.772 1425.071,177.803C1427.037,179.376 1428.794,180.982 1430.342,182.621C1436.082,188.7 1438.953,195.238 1438.953,202.236C1438.953,208.159 1437.009,213.11 1433.122,217.089C1429.235,221.069 1424.516,223.058 1418.963,223.058C1418.622,223.058 1418.284,223.051 1417.948,223.037C1406.431,222.553 1397.885,213.768 1392.31,196.683C1389.718,188.539 1387.636,182.986 1386.063,180.025C1384.489,177.063 1382.222,174.472 1379.261,172.251C1373.523,167.994 1366.489,165.865 1358.16,165.865C1347.24,165.865 1337.152,168.919 1327.898,175.027C1319.754,180.395 1312.859,187.104 1307.214,195.156C1301.568,203.207 1296.617,213.341 1292.36,225.557C1285.882,244.251 1282.643,262.576 1282.643,280.529C1282.643,297.003 1285.604,313.106 1291.527,328.838C1297.45,344.571 1305.501,357.713 1315.682,368.263C1331.599,384.921 1350.294,393.25 1371.764,393.25C1384.071,393.25 1394.912,390.542 1404.289,385.127C1403.726,384.801 1403.174,384.46 1402.634,384.103C1396.563,380.09 1393.528,375.052 1393.528,368.989C1393.528,359.894 1403.03,352.225 1422.033,345.983C1432.327,342.773 1445.062,340.142 1460.239,338.092C1475.416,336.041 1490.262,335.015 1504.779,335.015C1521.144,335.015 1538.168,336.442 1555.852,339.295C1564.671,340.718 1572.769,342.341 1580.144,344.163L1580.144,188.232L1541.584,188.232L1541.584,183.79C1557.2,179.903 1571.615,172.407 1584.829,161.301C1592.757,154.453 1599.123,147.651 1603.928,140.895C1608.733,134.139 1613.298,125.393 1617.622,114.658L1621.226,105.496L1634.559,105.496L1634.559,177.682L1726.453,177.682L1726.453,188.232L1634.559,188.232L1635.116,354.268C1634.91,369.663 1635.206,382.996 1635.213,393.769C1635.358,396.583 1635.431,399.647 1635.431,402.962L1635.431,501.941C1635.431,518.705 1636.486,530.118 1638.598,536.182C1643.085,548.844 1653.907,555.175 1671.063,555.175C1679.245,555.175 1685.646,554.194 1690.265,552.232C1694.884,550.271 1700.36,546.347 1706.695,540.462L1713.425,543.137C1703.924,561.863 1682.148,571.226 1648.1,571.226C1643.481,571.226 1639.054,571.036 1634.82,570.657C1621.876,569.497 1610.733,566.559 1601.382,561.863C1593.203,557.755 1584.754,550.627 1576.044,540.462C1562.225,548.823 1551.066,554.952 1542.566,558.849C1540.188,559.939 1538.018,560.854 1536.056,561.595C1518.9,568.015 1498.973,571.226 1476.273,571.226C1470.89,571.226 1465.712,571.063 1460.741,570.738C1438.905,569.31 1421.054,564.747 1407.187,557.048C1406.528,556.682 1405.883,556.312 1405.25,555.936C1389.517,546.605 1381.65,534.224 1381.65,518.794C1381.65,503.992 1388.645,491.597 1402.634,481.61C1410.552,476.082 1419.658,471.668 1429.952,468.368C1437.143,466.063 1446.589,463.737 1458.289,461.388C1463.336,460.375 1468.803,459.358 1474.69,458.337C1497.653,454.413 1514.611,451.114 1525.565,448.439C1536.518,445.764 1545.69,442.554 1553.081,438.809C1561.527,434.707 1567.334,429.892 1570.501,424.363C1573.668,418.835 1575.252,411.166 1575.252,401.357C1575.252,380.492 1569.445,365.244 1557.832,355.613C1552.553,351.155 1545.756,347.588 1537.442,344.913C1529.128,342.238 1520.484,340.9 1511.51,340.9C1500.688,340.9 1491.054,342.773 1482.608,346.518C1474.162,350.263 1467.827,355.435 1463.604,362.034L1453.706,377.549C1450.425,382.76 1445.511,386.351 1438.965,388.322C1434.982,389.522 1430.393,390.122 1425.201,390.122C1420.82,390.122 1416.786,389.644 1413.097,388.688C1411.672,389.816 1410.203,390.875 1408.69,391.862C1395.364,400.562 1377.039,404.911 1353.718,404.911C1316.329,404.911 1286.992,393.806 1265.707,371.595C1264.729,370.565 1263.775,369.522 1262.844,368.467ZM1575.754,489.803C1575.947,486.575 1576.044,483.219 1576.044,479.737L1576.044,435.063C1561.791,443.089 1546.086,450.133 1528.93,456.197C1509.662,463.152 1496.333,468.413 1488.943,471.98C1481.552,475.547 1474.822,479.827 1468.751,484.82C1456.346,495.164 1450.143,507.202 1450.143,520.934C1450.143,532.704 1454.96,542.424 1464.594,550.092C1474.228,557.761 1486.435,561.595 1501.216,561.595C1514.149,561.595 1526.357,558.876 1537.838,553.436C1539.44,552.677 1540.986,551.883 1542.477,551.053C1551.676,545.934 1558.774,539.461 1563.77,531.634C1570.695,521.522 1574.689,507.579 1575.754,489.803Z"/>
                </g>
            </g>
            <g transform="matrix(0.729048,0,0,0.729048,1122.378423,610.762968)">
                <text x="82.886px" y="336.522px" style="font-family:'BaskOldFace', 'Baskerville Old Face', serif;font-size:351.789px;">al<tspan x="304.142px 472.149px 602.881px 747.355px " y="336.522px 336.522px 336.522px 336.522px ">oged</tspan></text>
                <g transform="matrix(288,0,0,288,987.907202,336.522303)">
                </g>
                <text x="917.595px" y="336.522px" style="font-family:'BaskOldFace', 'Baskerville Old Face', serif;font-size:288px;">.</text>
            </g>
        </g>
    </g>
</svg>`;

  function renderLanding(){
    clearTATimers();
    clearTimeout(state.classicAdvanceTimer);
    state.screen = 'landing';
    updateChrome();
    screenEl.innerHTML = `
      <div class="hero">
        <h2 class="hero-title">${HERO_LOGO_SVG}</h2>
        <p class="hero-lede">${LANDING.tagline}</p>
        <div class="hero-actions">
          <button class="btn btn-primary" id="spotlightBtn">Spotlight</button>
          <button class="btn btn-primary" id="learnBtn">Learn</button>
          <button class="btn btn-primary" id="playBtn">Play</button>
        </div>
      </div>
      <button class="dev-link" id="devLinkBtn" type="button">dev</button>`;
    document.getElementById('spotlightBtn').addEventListener('click', renderContent);
    document.getElementById('learnBtn').addEventListener('click', renderLearn);
    document.getElementById('playBtn').addEventListener('click', renderModes);
    document.getElementById('devLinkBtn').addEventListener('click', renderDevPage);
  }

  // Builds the scrolling background mosaic from whatever artwork has
  // loaded into the pool so far. Cheap to rebuild — it only touches
  // image src attributes, which are already cached from preloading.
  // AIC serves IIFF images at whatever width is requested in the URL.
  // Gameplay uses 700px; the background mosaic only ever shows these
  // at ~70px, so requesting a much smaller render is a lot less data
  // to pull down and decode. Other sources are left as-is.
  function thumbUrl(url){
    return url.replace(/\/full\/\d+,\/0\/default\.jpg$/, '/full/200,/0/default.jpg');
  }

  function renderBgGrid(){
    const container = document.getElementById('bgGrid');
    if(!container) return;
    if(!state.pool.length){ container.innerHTML = ''; return; }

    const cols = 20;
    const tilesPerCol = 10;
    const needed = cols * tilesPerCol;

    // Cycle through a shuffled list of unique images rather than
    // sampling independently at random — independent random picks
    // statistically clump the same handful of images together even
    // with a decent-sized pool. Cycling spreads repeats evenly, and
    // once the pool has 200+ images there are no repeats at all.
    const unique = shuffle(state.pool.map(a => thumbUrl(a.img)));
    const sequence = [];
    for(let i = 0; i < needed; i++) sequence.push(unique[i % unique.length]);
    shuffle(sequence);

    let html = '';
    let idx = 0;
    for(let c = 0; c < cols; c++){
      const dur = (40 + Math.random() * 40).toFixed(1);
      const delay = -(Math.random() * dur).toFixed(1);
      let tiles = '';
      for(let r = 0; r < tilesPerCol; r++){
        tiles += `<img src="${sequence[idx++]}" alt="" referrerpolicy="no-referrer">`;
      }
      html += `<div class="bg-col"><div class="bg-col-track" style="animation:bgScroll ${dur}s linear infinite; animation-delay:${delay}s;">${tiles}${tiles}</div></div>`;
    }
    container.innerHTML = html;
  }

  // Swaps a portion of the already-rendered tiles to freshly-arrived
  // images, in place — the scroll animation keeps running undisturbed
  // (no rebuild), but the grid visibly keeps filling in with more
  // variety for a couple of seconds as more of the pool loads in.
  // Runs exactly once, staggering individual tile swaps across ~2s
  // so the grid visibly fills in with more variety without every
  // touched tile changing in the same frame (which is what caused
  // the flashing/row-flicker when this ran on every fetch).
  function diversifyBgGridOnce(){
    const container = document.getElementById('bgGrid');
    if(!container) return;
    const images = state.pool.map(a => thumbUrl(a.img));
    if(!images.length) return;
    container.querySelectorAll('img').forEach(img => {
      if(Math.random() < 0.45){
        const delay = Math.random() * 2200;
        setTimeout(() => {
          if(!document.body.contains(img)) return;
          img.src = pickRandom(images);
        }, delay);
      }
    });
  }

  // Kicks off a small fetch on boot, before the player has chosen a
  // mode, purely so the landing page's background mosaic has real
  // artwork to show rather than sitting empty on first visit. The
  // grid builds as soon as the first results land, then gets one
  // gentle diversify pass once everything has settled — after that
  // it's left alone for the rest of the session.
  function warmPoolInBackground(){
    let built = false;
    let diversified = false;
    const onFirstData = () => {
      if(built || !state.pool.length) return;
      built = true;
      if(state.screen !== 'round') renderBgGrid();
    };
    const promises = [];
    TERMS.forEach(t => {
      // Slower sources first — Met needs a follow-up detail fetch per
      // result, and SMK/Europeana/Smithsonian all add real network
      // latency — firing these the moment the page loads gives them the
      // longest possible head start while the visitor is still just
      // looking at the landing page, rather than waiting until a mode
      // is actually chosen.
      fetchMet(t).then(addToPool);
      fetchSMK(t).then(addToPool);
      fetchEuropeana(t).then(addToPool);
      fetchSmithsonian(t).then(addToPool);
      promises.push(fetchAIC(t).then(items => { addToPool(items); onFirstData(); }));
      promises.push(fetchCleveland(t).then(items => { addToPool(items); onFirstData(); }));
    });
    Promise.allSettled(promises).then(() => {
      if(diversified) return;
      diversified = true;
      if(state.screen !== 'round') diversifyBgGridOnce();
    });
  }

  /* ============================================================
     DAILY ARTWORK — one artwork per calendar day, persisted so it
     doesn't change on repeat visits within the same day.
     ============================================================ */
