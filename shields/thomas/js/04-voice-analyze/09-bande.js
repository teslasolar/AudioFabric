function bandE(f,lo,hi,bw){var s=0,a=Math.floor(lo/bw),b=Math.min(Math.floor(hi/bw),f.length-1);for(var i=a;i<=b;i++)s+=Math.pow(10,f[i]/10);return s;}
function clamp01(v){return Math.max(0,Math.min(1,v));}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

