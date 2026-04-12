
// Merge discovered video IDs into the playlist
function addVideosToPlaylist(videoIds) {
  var existingIds = {};
  playlist.forEach(function(p) { existingIds[p.id] = true; });
  videoIds.forEach(function(id) {
    if (!existingIds[id]) {
      playlist.push({ id: id, title: 'Track ' + (playlist.length + 1) + ' [' + id + ']', type: 'yt' });
      titleFetchQueue.push(playlist.length - 1);
    }
  });
  renderPlaylist();
  savePlaylist();
  if (!titleFetchBusy) fetchNextTitle();
  document.getElementById('pl-count').textContent = '(' + playlist.length + ')';
}

