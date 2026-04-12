function ytShuffle() {
  if (playlist.length < 2) return;
  // Fisher-Yates shuffle
  for (var i = playlist.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = playlist[i];
    playlist[i] = playlist[j];
    playlist[j] = temp;
  }
  plIndex = 0;
  renderPlaylist();
  savePlaylist();
  ytPlayIndex(0);
}

