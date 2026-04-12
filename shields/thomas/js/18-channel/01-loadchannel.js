function loadChannel() {
  if (!ytReady) { setTimeout(loadChannel, 1000); return; }
  var status = document.getElementById('channel-status');
  var btn = document.getElementById('btn-load-channel');
  status.style.display = 'block';
  status.textContent = 'loading channel videos...';
  btn.textContent = 'loading...';
  btn.disabled = true;

  // Fetch channel /videos page via CORS proxies to extract video IDs.
  // YouTube's embedded cuePlaylist(listType:'search') is restricted and
  // shows a player error, so we avoid it entirely.
  var channelUrl = 'https://www.youtube.com/@' + CHANNEL_HANDLE + '/videos';
  var proxies = [
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(channelUrl),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(channelUrl),
    'https://corsproxy.io/?' + encodeURIComponent(channelUrl)
  ];

  tryProxies(proxies, 0, function(videoIds) {
    if (videoIds && videoIds.length > 0) {
      addVideosToPlaylist(videoIds);
      finalizeChannelLoad();
      if (channelId) setTimeout(tryLoadUploadsPlaylist, 2000);
    } else {
      // All proxies failed or returned no videos
      btn.textContent = '\u25b6 LOAD ALL CHANNEL VIDEOS';
      btn.disabled = false;
      status.textContent = 'auto-load unavailable \u2014 paste YouTube URLs above';
    }
  });
}
