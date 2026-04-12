function tryProxies(proxies, idx, callback) {
  if (idx >= proxies.length) { callback(null); return; }
  var status = document.getElementById('channel-status');
  status.textContent = 'loading channel videos... (attempt ' + (idx + 1) + ')';

  fetch(proxies[idx]).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(function(html) {
    var videoIds = [];
    var seen = {};
    var re = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      if (!seen[m[1]]) { seen[m[1]] = true; videoIds.push(m[1]); }
    }
    var chIdMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/);
    if (chIdMatch) channelId = chIdMatch[1];

    if (videoIds.length > 0) {
      callback(videoIds);
    } else {
      // This proxy returned data but no video IDs — try next
      tryProxies(proxies, idx + 1, callback);
    }
  }).catch(function(e) {
    console.warn('Proxy ' + (idx + 1) + ' failed:', e.message);
    tryProxies(proxies, idx + 1, callback);
  });
}
