-- Phrase lists live apart from the game document: a game with hundreds of phrases
-- would exceed D1's 100 KB statement limit when saved as one JSON value.
CREATE TABLE game_phrases (
  code TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (code, key)
);

INSERT INTO game_phrases (code, key, data)
SELECT games.code, list.key, list.value
FROM games, json_each(json_extract(games.data, '$.phrases')) AS list
WHERE json_extract(games.data, '$.phrases') IS NOT NULL;

UPDATE games SET data = json_remove(data, '$.phrases') WHERE json_extract(data, '$.phrases') IS NOT NULL;
