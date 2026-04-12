
function fetchNextTitle() {
  if (titleFetchQueue.length === 0) { titleFetchBusy = false; return; }
  titleFetchBusy = true;
  var idx = titleFetchQueue.shift();
  if (idx >= playlist.length) { fetchNextTitle(); return; }

  // Use oEmbed to get title (CORS-friendly)
  var url = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' +
    encodeURIComponent(playlist[idx].id) + '&format=json';

  fetch(url).then(function(r) { return r.json(); }).then(function(data) {
    if (data && data.title) {
      playlist[idx].title = data.title;
      renderPlaylist();
      // Save every 10 titles
      if (titleFetchQueue.length % 10 === 0) savePlaylist();
    }
  }).catch(function() {}).finally(function() {
    // Throttle: 200ms between requests to be nice
    setTimeout(fetchNextTitle, 200);
  });
}

