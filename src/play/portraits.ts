// Harry's and Kim's portraits for the HUD (?ui=de): cut-paper faces with painted strokes over
// them, after the original's party portraits (drawn here, not copied): Harry, ruddy and worn,
// red-rimmed eyes over heavy bags, a bulbous nose, grey-shot hair and beard laid on in strokes,
// in his green blazer and the Horrific Necktie, against diagonal yellow and teal strokes; Kim in
// his orange bomber jacket against the white disc of his portrait, round glasses, short black
// hair. Each layer is a flat shape with a torn edge and a small drop shadow, as cut paper
// stacked up; the skin is built of planes in several tones (greens and violets in the shade,
// as the original's faces are painted); a canvas grain lies over it all. SVG strings: the HUD
// sets them into round frames.

/** Rough cut edges and the small shadow each layer throws; a dry brush; the canvas grain. */
const defs = (id: string, seed: number) => `
  <clipPath id="${id}-c"><circle cx="100" cy="100" r="100"/></clipPath>
  <filter id="${id}-cut" x="-8%" y="-8%" width="116%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feDropShadow in="d" dx="0.6" dy="1.5" stdDeviation="0.9" flood-color="#140b06" flood-opacity=".5"/>
  </filter>
  <filter id="${id}-brush" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05 0.11" numOctaves="3" seed="${seed + 5}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="${id}-grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="3" seed="${seed + 9}"/>
    <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 1.6 -0.62"/>
  </filter>`;

/** Short painted strokes: [x1 y1 cx cy x2 y2 width colour opacity] each. */
const strokes = (list: [number, number, number, number, number, number, number, string, number][]) =>
  list.map(([x1, y1, cx, cy, x2, y2, w, c, o]) => `<path d="M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}" fill="none" stroke-linecap="round"/>`).join('');

export const HARRY_SVG = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>${defs('hp', 3)}</defs>
<g clip-path="url(#hp-c)">
  <rect width="200" height="200" fill="#E4D7BC"/>
  <g filter="url(#hp-brush)">
    <path d="M-30 64 L96 -34 L130 -34 L-12 98Z" fill="#DB9F36"/>
    <path d="M-24 150 L158 -34 L178 -34 L-10 168Z" fill="#46909D"/>
    <path d="M134 36 L224 -26 L224 4 L152 56Z" fill="#DB9F36"/>
    <path d="M150 96 L232 22 L232 46 L162 116Z" fill="#46909D" opacity=".85"/>
    <path d="M56 232 L240 72 L240 98 L94 232Z" fill="#F2EDE2"/>
    <path d="M-24 36 L36 -24 L50 -24 L-24 52Z" fill="#F2EDE2" opacity=".8"/>
  </g>
  <g filter="url(#hp-cut)">
    <path d="M42 104 C32 76 40 42 64 28 C76 20 92 16 106 17 C134 18 156 36 161 64 C165 84 161 104 155 120 C149 132 141 140 131 146 L71 146 C55 136 46 120 42 104Z" fill="#40332B"/>
    <path d="M-12 214 L-12 180 C8 156 38 146 68 140 L132 140 C164 146 192 156 212 180 L212 214Z" fill="#3D6B39"/>
    <path d="M132 140 C164 146 192 156 212 180 L212 214 L152 214 C154 188 148 160 132 140Z" fill="#2C502E"/>
    ${strokes([[22, 182, 44, 162, 70, 154, 6, '#62955A', 0.75], [150, 164, 170, 170, 190, 188, 4, '#1F3B22', 0.8], [40, 204, 50, 188, 64, 178, 3, '#7FAE6E', 0.5]])}
  </g>
  <g filter="url(#hp-cut)">
    <path d="M72 138 L100 184 L128 138 L117 131 L100 156 L83 131Z" fill="#ECE5D7"/>
    <path d="M100 156 L117 131 L128 138 L104 176Z" fill="#CBC1B0"/>
    <path d="M92 154 L108 154 L113 214 L87 214Z" fill="#2C6946"/>
    <path d="M91 166 L103 162 L105 173 L94 177Z" fill="#C8402D"/>
    <path d="M100 181 L111 179 L112 191 L101 191Z" fill="#E2B13A"/>
    <path d="M89 193 L99 195 L98 207 L88 205Z" fill="#3D6EA8"/>
    <path d="M103 199 L112 199 L113 210 L104 210Z" fill="#C8402D"/>
    <path d="M68 140 L100 200 L78 214 L30 160Z" fill="#2A4B2B"/>
    <path d="M132 140 L100 200 L122 214 L170 160Z" fill="#223F29"/>
  </g>
  <g filter="url(#hp-cut)">
    <path d="M78 118 L122 118 L120 146 L100 158 L80 146Z" fill="#A5654E"/>
    <ellipse cx="57" cy="97" rx="8" ry="14" fill="#C8836A"/>
    <ellipse cx="144" cy="97" rx="8" ry="14" fill="#A1604B"/>
    <path d="M59 86 C57 54 76 35 100 35 C126 35 143 54 141 86 C140 106 138 124 128 136 C120 144 110 148 100 148 C90 148 80 144 72 136 C62 124 60 106 59 86Z" fill="#D59A7C"/>
    <path d="M113 38 C134 48 146 72 142 100 C140 122 132 136 118 144 C128 124 132 104 128 82 C126 64 120 50 113 38Z" fill="#A5604C"/>
    <path d="M63 84 C63 66 72 50 90 43 C80 56 75 70 75 86Z" fill="#E7B697"/>
    <path d="M64 104 C68 116 78 124 88 126 C80 116 76 108 74 100Z" fill="#C2644F" opacity=".85"/>
    <path d="M120 104 C124 114 128 120 132 122 C128 112 128 104 126 96Z" fill="#7D6457" opacity=".8"/>
    <path d="M68 71 C80 64 92 65 98 71 C92 77 78 78 68 71Z M102 71 C110 64 124 64 133 71 C124 78 110 77 102 71Z" fill="#8D4F43"/>
    <path d="M70 88 C76 96 86 97 94 91 C88 100 76 100 70 88Z M106 91 C114 97 124 96 130 88 C124 100 112 100 106 91Z" fill="#8B5A6C" opacity=".75"/>
  </g>
  <g filter="url(#hp-cut)">
    <path d="M56 66 C54 36 80 20 106 22 C134 24 152 42 148 70 C142 54 128 44 110 44 C92 44 78 50 70 58 C64 62 60 64 56 66Z" fill="#4B3D34"/>
    ${strokes([
      [60, 60, 66, 36, 92, 26, 3.6, '#7E7166', 0.9], [70, 44, 92, 30, 122, 32, 3, '#8C8074', 0.85], [96, 26, 124, 22, 146, 44, 3.4, '#6A5D52', 0.9],
      [128, 32, 148, 44, 152, 66, 2.6, '#8C8074', 0.7], [52, 70, 42, 84, 44, 104, 4.4, '#40332B', 0.95], [48, 58, 38, 70, 36, 84, 3, '#5E5248', 0.8],
      [154, 60, 164, 76, 160, 96, 4.4, '#40332B', 0.95], [150, 48, 162, 58, 166, 72, 2.6, '#6E6257', 0.8], [40, 88, 36, 100, 42, 112, 2.2, '#7E7166', 0.7],
      [160, 78, 164, 92, 158, 106, 2.2, '#7E7166', 0.7], [80, 30, 100, 24, 116, 28, 2, '#A99C8E', 0.6],
    ])}
    <path d="M58 86 C56 116 68 144 99 152 C131 146 145 116 142 86 C138 102 134 114 124 120 C112 112 88 112 76 120 C66 114 62 102 58 86Z" fill="#45352A"/>
    ${strokes([
      [62, 96, 64, 118, 76, 134, 3, '#6E6052', 0.9], [70, 128, 84, 142, 100, 146, 2.6, '#857667', 0.85], [102, 146, 120, 142, 132, 128, 2.6, '#6E6052', 0.9],
      [136, 100, 136, 118, 126, 134, 3, '#5B4C40', 0.9], [80, 136, 92, 146, 108, 144, 1.8, '#A09080', 0.6], [66, 110, 70, 124, 82, 132, 1.6, '#9A8A7A', 0.55],
    ])}
    <path d="M74 112 C86 101 114 101 126 112 C118 121 108 116 100 120 C92 116 82 121 74 112Z" fill="#33261E"/>
    ${strokes([[78, 112, 88, 106, 98, 108, 1.6, '#6C5A4B', 0.8], [102, 108, 112, 106, 122, 112, 1.6, '#6C5A4B', 0.8]])}
    <path d="M86 123 C92 127 108 127 114 123 C110 133 90 133 86 123Z" fill="#3A1D18"/>
  </g>
  <g filter="url(#hp-cut)">
    <path d="M95 74 C91 88 84 98 88 106 C93 111 107 111 111 105 C114 98 106 88 103 74Z" fill="#C3634D"/>
    <ellipse cx="99" cy="104" rx="10.5" ry="7.2" fill="#BD4A3C"/>
    <ellipse cx="81" cy="82" rx="10" ry="5.2" fill="#B8483E"/>
    <ellipse cx="119" cy="82" rx="10" ry="5.2" fill="#A94034"/>
    <ellipse cx="81" cy="82.6" rx="6.2" ry="2.4" fill="#E8D8C3"/>
    <ellipse cx="119" cy="82.6" rx="6.2" ry="2.4" fill="#DDCAB5"/>
    <circle cx="83" cy="82.7" r="2" fill="#211411"/>
    <circle cx="121" cy="82.7" r="2" fill="#211411"/>
    <path d="M70 79 Q81 74 92 79 L92 81 Q81 77 70 81Z M108 79 Q119 74 130 79 L130 81 Q119 77 108 81Z" fill="#7A3E33"/>
  </g>
  ${strokes([
    [68, 73, 80, 62, 94, 71, 5.4, '#2E211A', 1], [106, 71, 120, 62, 132, 72, 5.4, '#2E211A', 1],
    [72, 91, 81, 96, 90, 91, 2.4, '#95504A', 0.9], [110, 91, 119, 96, 128, 91, 2.4, '#95504A', 0.9],
    [86, 50, 100, 45, 116, 50, 4.4, '#F0C8AA', 0.8], [84, 60, 98, 57, 110, 60, 1.8, '#B07560', 0.7],
    [97, 78, 96, 86, 95, 94, 2.6, '#E6AE93', 0.85], [93, 100, 96, 98, 99, 99, 2.4, '#EC9585', 0.8],
    [130, 70, 135, 84, 130, 108, 3, '#7F8C66', 0.45], [66, 76, 64, 88, 68, 98, 2, '#EABFA3', 0.55],
    [104, 100, 108, 98, 110, 102, 1.4, '#8E2E26', 0.6],
  ])}
  <rect width="200" height="200" filter="url(#hp-grain)" opacity=".3" style="mix-blend-mode:multiply"/>
</g>
</svg>`;

export const KIM_SVG = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>${defs('kp', 11)}</defs>
<g clip-path="url(#kp-c)">
  <rect width="200" height="200" fill="#2B201A"/>
  <g filter="url(#kp-brush)">
    <path d="M-20 34 L64 -20 L84 -20 L-20 56Z" fill="#3E2F25"/>
    <path d="M150 204 L222 122 L222 152 L172 212Z" fill="#3E2F25"/>
  </g>
  <circle cx="104" cy="80" r="70" fill="#EDE7DB" filter="url(#kp-brush)"/>
  <g transform="translate(101 96) scale(1.14) translate(-101 -92)">
  <g filter="url(#kp-cut)">
    <path d="M-12 214 L-12 176 C12 152 44 142 70 138 L130 138 C158 142 190 152 212 176 L212 214Z" fill="#D5712A"/>
    <path d="M130 138 C158 142 190 152 212 176 L212 214 L148 214 C152 186 146 160 130 138Z" fill="#A24E1C"/>
    ${strokes([[22, 184, 42, 164, 66, 154, 6, '#F19C50', 0.8], [44, 200, 56, 186, 70, 180, 3.6, '#F19C50', 0.55], [150, 170, 168, 176, 184, 196, 4, '#7E3A14', 0.7], [60, 206, 80, 196, 92, 196, 2.4, '#F6B070', 0.5]])}
    <path d="M101 150 L103 214" stroke="#5F2C12" stroke-width="2.6"/>
    <circle cx="134" cy="180" r="8" fill="#EDE6D8"/>
    <circle cx="134" cy="180" r="4.4" fill="none" stroke="#8B857B" stroke-width="1.3"/>
  </g>
  <g filter="url(#kp-cut)">
    <path d="M84 114 L118 114 L118 138 L101 146 L84 138Z" fill="#AB7152"/>
    <path d="M78 134 L101 152 L124 134 L118 128 L101 142 L84 128Z" fill="#3A3029"/>
    <path d="M60 136 C70 128 80 126 86 128 L101 150 L78 164 C70 156 64 146 60 136Z" fill="#C05F22"/>
    <path d="M142 136 C132 128 122 126 116 128 L101 150 L124 164 C132 156 138 146 142 136Z" fill="#96461A"/>
  </g>
  <g filter="url(#kp-cut)">
    <ellipse cx="66" cy="88" rx="6" ry="11" fill="#C48B67"/>
    <ellipse cx="136" cy="88" rx="6" ry="11" fill="#A26A4B"/>
    <path d="M67 80 C67 54 82 40 101 40 C121 40 135 54 135 80 C135 96 132 108 126 118 C119 128 110 134 101 134 C92 134 83 128 77 120 C70 110 67 96 67 80Z" fill="#D7A27C"/>
    <path d="M114 44 C130 54 136 76 132 98 C130 112 124 124 112 130 C120 112 122 92 120 74 C119 62 117 52 114 44Z" fill="#A5694A"/>
    <path d="M72 76 C72 62 80 50 92 46 C84 58 80 68 80 82Z" fill="#E7BA96"/>
    <path d="M74 98 C78 110 86 118 94 122 C86 112 82 104 80 96Z" fill="#B87550" opacity=".8"/>
    <path d="M120 100 C122 108 122 116 118 122 C124 116 128 108 128 98Z" fill="#8A6A5A" opacity=".7"/>
  </g>
  <g filter="url(#kp-cut)">
    <path d="M66 80 C62 54 76 36 100 34 C124 32 140 48 137 76 C134 64 128 58 120 56 C120 50 116 46 108 46 C96 46 84 50 76 58 C70 64 68 72 66 80Z" fill="#1A1613"/>
    <path d="M78 46 C86 30 108 22 128 30 C136 34 140 42 140 50 C132 42 120 38 106 40 C94 42 84 46 78 46Z" fill="#1A1613"/>
    ${strokes([[88, 38, 104, 30, 126, 34, 2.2, '#4E4843', 0.9], [82, 44, 96, 38, 110, 38, 1.6, '#3E3935', 0.8], [124, 34, 134, 40, 138, 50, 1.8, '#4E4843', 0.7]])}
    <path d="M66 80 L67 96 L71 96 L71 76Z M137 76 L136 96 L132 96 L132 74Z" fill="#1A1613"/>
  </g>
  <circle cx="86" cy="86" r="11.5" fill="#E9EEF0" fill-opacity=".2" stroke="#161412" stroke-width="3"/>
  <circle cx="116" cy="86" r="11.5" fill="#E9EEF0" fill-opacity=".16" stroke="#161412" stroke-width="3"/>
  <path d="M97.5 84 Q101 81.5 104.5 84" stroke="#161412" stroke-width="2.4" fill="none"/>
  <path d="M74.5 84 L67 81 M127.5 84 L135 81" stroke="#161412" stroke-width="2.4"/>
  <ellipse cx="86" cy="87" rx="2.8" ry="1.9" fill="#251913"/>
  <ellipse cx="116" cy="87" rx="2.8" ry="1.9" fill="#251913"/>
  ${strokes([
    [79, 80, 83, 77.5, 87, 78.5, 1.8, '#F5F1EA', 0.9], [109, 78.5, 113, 77.5, 117, 80, 1.8, '#F5F1EA', 0.9],
    [77, 71, 86, 67, 95, 71, 3, '#211813', 1], [107, 71, 116, 67, 125, 71, 3, '#211813', 1],
    [101, 92, 97, 102, 102, 106, 2.1, '#8E583A', 1], [92, 116, 101, 118.5, 110, 115.5, 2.4, '#733F2E', 1],
    [84, 56, 97, 52, 112, 55, 3.4, '#EDC3A1', 0.55], [124, 88, 126, 100, 122, 110, 2.4, '#7F6A62', 0.4],
  ])}
  </g>
  <rect width="200" height="200" filter="url(#kp-grain)" opacity=".3" style="mix-blend-mode:multiply"/>
</g>
</svg>`;
