-- Bulk aliases for frequently confused Unicode names (Nova guild only)
-- These are OCR variants that Claude Vision reads differently each time.
-- Uses ON CONFLICT DO NOTHING to avoid overwriting existing aliases.

DO $$
DECLARE
  nova_id UUID;
BEGIN
  SELECT id INTO nova_id FROM guilds WHERE LOWER(name) = 'nova' OR LOWER(slug) = 'nova' LIMIT 1;
  IF nova_id IS NULL THEN
    RAISE NOTICE 'Guild Nova not found — skipping bulk alias insert';
    RETURN;
  END IF;

  -- 乃ooバ|モ (Boom) — 6 OCR variants
  INSERT INTO aliases (guild_id, normalized_key, actual_name, type) VALUES
    (nova_id, '乃ooπ | モ',  '乃ooバ | モ', 'member'),
    (nova_id, '乃oo爪|モ',   '乃ooバ | モ', 'member'),
    (nova_id, '乃oo爪丨モ',  '乃ooバ | モ', 'member'),
    (nova_id, '乃oo爪丨毛',  '乃ooバ | モ', 'member'),
    (nova_id, '乃ooバ丨モ',  '乃ooバ | モ', 'member'),
    (nova_id, '乃oo爪｜モ',  '乃ooバ | モ', 'member')
  ON CONFLICT DO NOTHING;

  -- Cakoぞ゜ — 6 OCR variants
  INSERT INTO aliases (guild_id, normalized_key, actual_name, type) VALUES
    (nova_id, 'Cakoそ',    'Cakoぞ゜', 'member'),
    (nova_id, 'Cakoぞ°',   'Cakoぞ゜', 'member'),
    (nova_id, 'Cakoぞ゛',   'Cakoぞ゜', 'member'),
    (nova_id, 'Cakoヌ*',   'Cakoぞ゜', 'member'),
    (nova_id, 'Cakoヌ゛',   'Cakoぞ゜', 'member'),
    (nova_id, 'Cako♂',    'Cakoぞ゜', 'member')
  ON CONFLICT DO NOTHING;

  -- 长尺丨丁十 (KRITH) — 5 OCR variants
  INSERT INTO aliases (guild_id, normalized_key, actual_name, type) VALUES
    (nova_id, '长尺 I 丁卄',  '长尺丨丁十', 'member'),
    (nova_id, '长尺 l 丁卄',  '长尺丨丁十', 'member'),
    (nova_id, '长尺丨丁什',   '长尺丨丁十', 'member'),
    (nova_id, '长尺丨丁卜',   '长尺丨丁十', 'member'),
    (nova_id, '长尺｜丁什',   '长尺丨丁十', 'member')
  ON CONFLICT DO NOTHING;

  -- 乃卍G✖丁乙ひ — 3 OCR variants
  INSERT INTO aliases (guild_id, normalized_key, actual_name, type) VALUES
    (nova_id, '乃卞Gメ丁乙ひ', '乃卍G✖丁乙ひ', 'member'),
    (nova_id, '卄яGひルツ',    '乃卍G✖丁乙ひ', 'member'),
    (nova_id, '计书Gαルツ',    '乃卍G✖丁乙ひ', 'member')
  ON CONFLICT DO NOTHING;

  -- くZava — 1 OCR variant
  INSERT INTO aliases (guild_id, normalized_key, actual_name, type) VALUES
    (nova_id, 'ᐸZavaᐳ', 'くZava', 'member')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted bulk aliases for Nova guild (% id)', nova_id;
END $$;
