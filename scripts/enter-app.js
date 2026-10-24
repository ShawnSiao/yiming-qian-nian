// Keep language links, score bookmarks and screen hashes across the entry move.
location.replace(new URL('./app/'+location.search+location.hash,location.href).href);
