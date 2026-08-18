/* places.js — a built-in gazetteer so the site needs no network at all.
 * [name, region, latitude, longitude, IANA zone]
 */
(function (global) {
  'use strict';
  var P = [
    ['Dublin','Ireland',53.3498,-6.2603,'Europe/Dublin'],
    ['Galway','Ireland',53.2707,-9.0568,'Europe/Dublin'],
    ['Cork','Ireland',51.8985,-8.4756,'Europe/Dublin'],
    ['Sligo','Ireland',54.2766,-8.4761,'Europe/Dublin'],
    ['Belfast','United Kingdom',54.5973,-5.9301,'Europe/London'],
    ['London','United Kingdom',51.5072,-0.1276,'Europe/London'],
    ['Edinburgh','United Kingdom',55.9533,-3.1883,'Europe/London'],
    ['Glasgow','United Kingdom',55.8642,-4.2518,'Europe/London'],
    ['Cardiff','United Kingdom',51.4816,-3.1791,'Europe/London'],
    ['Manchester','United Kingdom',53.4808,-2.2426,'Europe/London'],
    ['Stonehenge','United Kingdom',51.1789,-1.8262,'Europe/London'],
    ['Reykjavik','Iceland',64.1466,-21.9426,'Atlantic/Reykjavik'],
    ['Oslo','Norway',59.9139,10.7522,'Europe/Oslo'],
    ['Tromso','Norway',69.6496,18.9560,'Europe/Oslo'],
    ['Stockholm','Sweden',59.3293,18.0686,'Europe/Stockholm'],
    ['Helsinki','Finland',60.1699,24.9384,'Europe/Helsinki'],
    ['Copenhagen','Denmark',55.6761,12.5683,'Europe/Copenhagen'],
    ['Amsterdam','Netherlands',52.3676,4.9041,'Europe/Amsterdam'],
    ['Berlin','Germany',52.5200,13.4050,'Europe/Berlin'],
    ['Munich','Germany',48.1351,11.5820,'Europe/Berlin'],
    ['Paris','France',48.8566,2.3522,'Europe/Paris'],
    ['Madrid','Spain',40.4168,-3.7038,'Europe/Madrid'],
    ['Lisbon','Portugal',38.7223,-9.1393,'Europe/Lisbon'],
    ['Rome','Italy',41.9028,12.4964,'Europe/Rome'],
    ['Vienna','Austria',48.2082,16.3738,'Europe/Vienna'],
    ['Zurich','Switzerland',47.3769,8.5417,'Europe/Zurich'],
    ['Prague','Czechia',50.0755,14.4378,'Europe/Prague'],
    ['Warsaw','Poland',52.2297,21.0122,'Europe/Warsaw'],
    ['Budapest','Hungary',47.4979,19.0402,'Europe/Budapest'],
    ['Athens','Greece',37.9838,23.7275,'Europe/Athens'],
    ['Istanbul','Turkey',41.0082,28.9784,'Europe/Istanbul'],
    ['Kyiv','Ukraine',50.4501,30.5234,'Europe/Kyiv'],
    ['Moscow','Russia',55.7558,37.6173,'Europe/Moscow'],
    ['St Petersburg','Russia',59.9311,30.3609,'Europe/Moscow'],
    ['Reykholt','Iceland',64.6640,-21.2900,'Atlantic/Reykjavik'],

    ['New York','United States',40.7128,-74.0060,'America/New_York'],
    ['Boston','United States',42.3601,-71.0589,'America/New_York'],
    ['Philadelphia','United States',39.9526,-75.1652,'America/New_York'],
    ['Washington DC','United States',38.9072,-77.0369,'America/New_York'],
    ['Atlanta','United States',33.7490,-84.3880,'America/New_York'],
    ['Miami','United States',25.7617,-80.1918,'America/New_York'],
    ['Detroit','United States',42.3314,-83.0458,'America/Detroit'],
    ['Chicago','United States',41.8781,-87.6298,'America/Chicago'],
    ['Minneapolis','United States',44.9778,-93.2650,'America/Chicago'],
    ['Nashville','United States',36.1627,-86.7816,'America/Chicago'],
    ['New Orleans','United States',29.9511,-90.0715,'America/Chicago'],
    ['Austin','United States',30.2672,-97.7431,'America/Chicago'],
    ['Dallas','United States',32.7767,-96.7970,'America/Chicago'],
    ['Houston','United States',29.7604,-95.3698,'America/Chicago'],
    ['Denver','United States',39.7392,-104.9903,'America/Denver'],
    ['Boulder','United States',40.0150,-105.2705,'America/Denver'],
    ['Santa Fe','United States',35.6870,-105.9378,'America/Denver'],
    ['Salt Lake City','United States',40.7608,-111.8910,'America/Denver'],
    ['Phoenix','United States',33.4484,-112.0740,'America/Phoenix'],
    ['Las Vegas','United States',36.1699,-115.1398,'America/Los_Angeles'],
    ['Los Angeles','United States',34.0522,-118.2437,'America/Los_Angeles'],
    ['San Diego','United States',32.7157,-117.1611,'America/Los_Angeles'],
    ['San Francisco','United States',37.7749,-122.4194,'America/Los_Angeles'],
    ['Portland','United States',45.5152,-122.6784,'America/Los_Angeles'],
    ['Seattle','United States',47.6062,-122.3321,'America/Los_Angeles'],
    ['Anchorage','United States',61.2181,-149.9003,'America/Anchorage'],
    ['Fairbanks','United States',64.8378,-147.7164,'America/Anchorage'],
    ['Honolulu','United States',21.3069,-157.8583,'Pacific/Honolulu'],
    ['Asheville','United States',35.5951,-82.5515,'America/New_York'],
    ['Portland ME','United States',43.6591,-70.2568,'America/New_York'],
    ['Vancouver','Canada',49.2827,-123.1207,'America/Vancouver'],
    ['Calgary','Canada',51.0447,-114.0719,'America/Edmonton'],
    ['Winnipeg','Canada',49.8951,-97.1384,'America/Winnipeg'],
    ['Toronto','Canada',43.6532,-79.3832,'America/Toronto'],
    ['Ottawa','Canada',45.4215,-75.6972,'America/Toronto'],
    ['Montreal','Canada',45.5019,-73.5674,'America/Toronto'],
    ['Halifax','Canada',44.6488,-63.5752,'America/Halifax'],
    ['Yellowknife','Canada',62.4540,-114.3718,'America/Yellowknife'],
    ['Mexico City','Mexico',19.4326,-99.1332,'America/Mexico_City'],
    ['Guadalajara','Mexico',20.6597,-103.3496,'America/Mexico_City'],
    ['Havana','Cuba',23.1136,-82.3666,'America/Havana'],
    ['San Juan','Puerto Rico',18.4655,-66.1057,'America/Puerto_Rico'],
    ['Guatemala City','Guatemala',14.6349,-90.5069,'America/Guatemala'],
    ['San Jose','Costa Rica',9.9281,-84.0907,'America/Costa_Rica'],
    ['Bogota','Colombia',4.7110,-74.0721,'America/Bogota'],
    ['Quito','Ecuador',-0.1807,-78.4678,'America/Guayaquil'],
    ['Lima','Peru',-12.0464,-77.0428,'America/Lima'],
    ['Cusco','Peru',-13.5319,-71.9675,'America/Lima'],
    ['La Paz','Bolivia',-16.4897,-68.1193,'America/La_Paz'],
    ['Santiago','Chile',-33.4489,-70.6693,'America/Santiago'],
    ['Buenos Aires','Argentina',-34.6037,-58.3816,'America/Argentina/Buenos_Aires'],
    ['Montevideo','Uruguay',-34.9011,-56.1645,'America/Montevideo'],
    ['Sao Paulo','Brazil',-23.5505,-46.6333,'America/Sao_Paulo'],
    ['Rio de Janeiro','Brazil',-22.9068,-43.1729,'America/Sao_Paulo'],
    ['Manaus','Brazil',-3.1190,-60.0217,'America/Manaus'],
    ['Ushuaia','Argentina',-54.8019,-68.3030,'America/Argentina/Ushuaia'],

    ['Casablanca','Morocco',33.5731,-7.5898,'Africa/Casablanca'],
    ['Cairo','Egypt',30.0444,31.2357,'Africa/Cairo'],
    ['Lagos','Nigeria',6.5244,3.3792,'Africa/Lagos'],
    ['Accra','Ghana',5.6037,-0.1870,'Africa/Accra'],
    ['Nairobi','Kenya',-1.2921,36.8219,'Africa/Nairobi'],
    ['Addis Ababa','Ethiopia',9.0320,38.7469,'Africa/Addis_Ababa'],
    ['Johannesburg','South Africa',-26.2041,28.0473,'Africa/Johannesburg'],
    ['Cape Town','South Africa',-33.9249,18.4241,'Africa/Johannesburg'],
    ['Windhoek','Namibia',-22.5609,17.0658,'Africa/Windhoek'],

    ['Jerusalem','Israel',31.7683,35.2137,'Asia/Jerusalem'],
    ['Dubai','UAE',25.2048,55.2708,'Asia/Dubai'],
    ['Tehran','Iran',35.6892,51.3890,'Asia/Tehran'],
    ['Karachi','Pakistan',24.8607,67.0011,'Asia/Karachi'],
    ['Delhi','India',28.6139,77.2090,'Asia/Kolkata'],
    ['Mumbai','India',19.0760,72.8777,'Asia/Kolkata'],
    ['Bengaluru','India',12.9716,77.5946,'Asia/Kolkata'],
    ['Kathmandu','Nepal',27.7172,85.3240,'Asia/Kathmandu'],
    ['Dhaka','Bangladesh',23.8103,90.4125,'Asia/Dhaka'],
    ['Bangkok','Thailand',13.7563,100.5018,'Asia/Bangkok'],
    ['Hanoi','Vietnam',21.0278,105.8342,'Asia/Ho_Chi_Minh'],
    ['Singapore','Singapore',1.3521,103.8198,'Asia/Singapore'],
    ['Jakarta','Indonesia',-6.2088,106.8456,'Asia/Jakarta'],
    ['Manila','Philippines',14.5995,120.9842,'Asia/Manila'],
    ['Hong Kong','China',22.3193,114.1694,'Asia/Hong_Kong'],
    ['Guangzhou','China',23.1291,113.2644,'Asia/Shanghai'],
    ['Shanghai','China',31.2304,121.4737,'Asia/Shanghai'],
    ['Beijing','China',39.9042,116.4074,'Asia/Shanghai'],
    ['Xian','China',34.3416,108.9398,'Asia/Shanghai'],
    ['Harbin','China',45.8038,126.5349,'Asia/Shanghai'],
    ['Taipei','Taiwan',25.0330,121.5654,'Asia/Taipei'],
    ['Seoul','South Korea',37.5665,126.9780,'Asia/Seoul'],
    ['Tokyo','Japan',35.6762,139.6503,'Asia/Tokyo'],
    ['Kyoto','Japan',35.0116,135.7681,'Asia/Tokyo'],
    ['Sapporo','Japan',43.0618,141.3545,'Asia/Tokyo'],
    ['Ulaanbaatar','Mongolia',47.8864,106.9057,'Asia/Ulaanbaatar'],
    ['Almaty','Kazakhstan',43.2220,76.8512,'Asia/Almaty'],
    ['Novosibirsk','Russia',55.0084,82.9357,'Asia/Novosibirsk'],

    ['Perth','Australia',-31.9523,115.8613,'Australia/Perth'],
    ['Adelaide','Australia',-34.9285,138.6007,'Australia/Adelaide'],
    ['Melbourne','Australia',-37.8136,144.9631,'Australia/Melbourne'],
    ['Sydney','Australia',-33.8688,151.2093,'Australia/Sydney'],
    ['Brisbane','Australia',-27.4698,153.0251,'Australia/Brisbane'],
    ['Hobart','Australia',-42.8821,147.3272,'Australia/Hobart'],
    ['Darwin','Australia',-12.4634,130.8456,'Australia/Darwin'],
    ['Auckland','New Zealand',-36.8485,174.7633,'Pacific/Auckland'],
    ['Wellington','New Zealand',-41.2866,174.7756,'Pacific/Auckland'],
    ['Christchurch','New Zealand',-43.5321,172.6362,'Pacific/Auckland'],
    ['Suva','Fiji',-18.1248,178.4501,'Pacific/Fiji'],
    ['Honiara','Solomon Islands',-9.4456,159.9729,'Pacific/Guadalcanal'],
    ['Greenwich','United Kingdom',51.4779,-0.0015,'Europe/London'],
    ['Longyearbyen','Svalbard',78.2232,15.6267,'Arctic/Longyearbyen'],
    ['McMurdo Station','Antarctica',-77.8419,166.6863,'Pacific/Auckland']
  ];

  var PLACES = P.map(function (r) {
    return { name: r[0], region: r[1], lat: r[2], lon: r[3], tz: r[4],
             label: r[0] + ', ' + r[1] };
  });

  function search(q, limit) {
    q = (q || '').trim().toLowerCase();
    if (!q) return PLACES.slice(0, limit || 12);
    var starts = [], contains = [];
    for (var i = 0; i < PLACES.length; i++) {
      var l = PLACES[i].label.toLowerCase();
      if (l.indexOf(q) === 0 || PLACES[i].name.toLowerCase().indexOf(q) === 0) starts.push(PLACES[i]);
      else if (l.indexOf(q) >= 0) contains.push(PLACES[i]);
    }
    return starts.concat(contains).slice(0, limit || 12);
  }

  /* Nearest listed place to a coordinate — used to guess a zone after the
   * browser hands back a raw latitude and longitude. */
  function nearest(lat, lon) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      var dLat = p.lat - lat;
      var dLon = ((p.lon - lon + 540) % 360) - 180;
      var d = dLat * dLat + Math.pow(dLon * Math.cos(lat * Math.PI / 180), 2);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  global.Places = { all: PLACES, search: search, nearest: nearest };
})(typeof window !== 'undefined' ? window : globalThis);
