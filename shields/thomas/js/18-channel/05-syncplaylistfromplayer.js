function syncPlaylistFromPlayer() {
  try {
    var ids = ytPlayer.getPlaylist();
    if (!ids || ids.length === 0) return;

    // Merge player playlist with our playlist (avoid duplicates)
    var existingIds = {};
    playlist.forEach(function(item) { existingIds[item.id] = true; });

    var newCount = 0;
    ids.forEach(function(id, idx) {
      if (!existingIds[id]) {
        playlist.push({ id: id, title: 'Track ' + (playlist.length + 1) + ' [' + id + ']', type: 'yt' });
        newCount++;
        titleFetchQueue.push(playlist.length - 1);
      }
    });

    if (newCount > 0) {
      renderPlaylist();
      savePlaylist();
      var status = document.getElementById('channel-status');
      status.textContent = 'loaded ' + playlist.length + ' videos';

      // Start fetching titles in background
      if (!titleFetchBusy) fetchNextTitle();
    }

    document.getElementById('pl-count').textContent = '(' + playlist.length + ')';
  } catch(e) {
    console.error('syncPlaylistFromPlayer:', e);
  }
}
