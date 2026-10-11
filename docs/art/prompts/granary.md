# 곡물 창고 이미지 생성 요청문 (Codex 전달용)

아래 요청문을 이미지 생성 도구(Codex의 그림 도구 등)에 하나씩 넣는다.
결과물은 사양을 확인한 뒤 표의 경로에 그대로 저장한다. 저장하면 코드 수정 없이 임시 그림 대신 쓰인다.
가능하면 참조 이미지로 `public/assets/inn/interior-v1.webp`(장소), `public/assets/inn/innkeeper-v1.webp`(인물)을 함께 넣어 화풍을 맞춘다.

## 공통 화풍 문장 (모든 요청문 앞에 붙인다)

```
Asset for the Korean Three Kingdoms strategy game "Cheonha Gunjin". High-end hand-painted realistic historical concept illustration with subtle ink wash, late Eastern Han dynasty (around 190 AD), northern China. Warm lantern light and cool dusk mist, dark jade and charcoal palette, weathered wood and rammed earth textures. Match the style of the reference image. No text, letters, signs with writing, logos, watermarks, frames, UI, modern objects, or anime style.
```

## 장소 (16:9 가로, 불투명 배경, 1920×1080 권장)

### `public/assets/runtime/locations/granary/yard.webp`
```
Wide 16:9 environment painting, no main characters. The front yard of a city granary: a tall timber granary hall on a raised stone platform with a dark tiled hip roof and small barred ventilation windows, surrounded by rammed-earth walls with tiled coping. On the left a two-wheeled wooden cart loaded with grain sacks and a porter carrying a sack; in the middle a pile of hemp grain sacks; on the right two small guard figures with spears and a narrow side lane blocked by toppled wooden crates. Two paper lanterns hang from the eaves. Late afternoon light. Keep the lower 15% of the image visually quiet.
```

### `public/assets/runtime/locations/granary/office.webp`
```
Wide 16:9 interior painting, no main characters. The gate office of a granary: a long dark wooden desk stacked with bound bamboo-slip ledgers, a wall rack of bronze keys, a small red seal box, a lattice window casting slanted warm light, a hanging lantern, timber posts. Quiet, orderly, slightly dusty.
```

### `public/assets/runtime/locations/granary/interior.webp`
```
Wide 16:9 interior painting, no main characters. Inside a dim grain storehouse: tall stacks of hemp grain sacks on both sides, large earthenware storage jars, at the back a heavy wooden door banded with iron and closed with a padlock guarding a reserve section, a single high window casting a dusty beam of light, in the foreground one torn sack spilling grain on the floor.
```

### `public/assets/runtime/locations/granary/loading.webp`
```
Wide 16:9 environment painting, no main characters. A narrow loading lane between two high rammed-earth walls leading toward a city gate tower in the distance. A wooden loading ramp with sacks on the right, a loaded two-wheeled cart squeezing through the lane, a small porter figure. Afternoon haze, sense of a tight passage.
```

## 인물 (2:3 세로, 투명 배경, 1024×1536)

### `public/assets/runtime/characters/granary-keeper/portrait.webp`
```
Portrait 2:3, waist-up, transparent background (if transparency is impossible, plain dark backdrop). Original character Wang Shang, the keeper of a city granary: an East Asian man in his late forties, black cloth headwrap, neatly trimmed mustache and short beard, faded brown official's robe with crossed collar, holding a bound bamboo-slip ledger in both hands, a ring of bronze keys hanging at his belt. Diligent but calculating expression, facing slightly left with eyes toward the viewer. Head fully visible with margin above, face centered horizontally in the upper quarter.
```
