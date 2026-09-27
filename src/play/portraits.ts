// Harry's and Kim's portraits for the HUD (?ui=de): cut-paper faces with painted strokes over
// them, after the original's party portraits (drawn here, not copied): Harry, ruddy and worn,
// red-rimmed eyes over bags, a bulbous nose, grey-shot sideburns and beard, in his green blazer
// and the Horrific Necktie, against diagonal yellow and teal strokes; Kim in his orange bomber
// jacket against the white disc of his portrait, round glasses, short black hair. Each layer is
// a flat shape with a torn edge and a small drop shadow, as cut paper stacked up; the skin is
// built of planes in several tones, as the original's faces are painted. SVG strings: the HUD
// sets them into round frames.

/** Rough cut edges and the small shadow each paper layer throws on the one below; a dry brush. */
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
  </filter>`;

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
    <path d="M40 102 C30 76 38 42 62 28 C74 20 90 16 104 17 C132 18 156 36 162 64 C166 84 162 104 156 120 C150 132 142 140 132 146 L70 146 C54 136 44 120 40 102Z" fill="#43352C"/>
    <path d="M44 70 C38 80 36 92 40 104 M50 56 C42 62 38 70 36 80 M154 58 C162 66 164 78 162 90 M150 46 C158 50 164 58 166 68" stroke="#43352C" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M40 84 C36 94 38 104 42 112 M160 74 C164 86 162 98 158 108" stroke="#6E6155" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M-12 214 L-12 180 C8 156 38 146 68 140 L132 140 C164 146 192 156 212 180 L212 214Z" fill="#3D6B39"/>
    <path d="M132 140 C164 146 192 156 212 180 L212 214 L152 214 C154 188 148 160 132 140Z" fill="#2C502E"/>
    <path d="M22 182 C36 168 52 158 70 154" stroke="#62955A" stroke-width="6" fill="none" stroke-linecap="round" opacity=".75"/>
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
    <path d="M78 118 L122 118 L120 146 L100 158 L80 146Z" fill="#A9674F"/>
    <ellipse cx="56" cy="96" rx="8" ry="14" fill="#C8836A"/>
    <ellipse cx="145" cy="96" rx="8" ry="14" fill="#A8634D"/>
    <path d="M58 88 C56 54 76 36 100 36 C126 36 144 54 142 88 C141 108 138 124 128 134 C120 142 110 146 100 146 C90 146 80 142 72 134 C62 124 59 108 58 88Z" fill="#D69C7F"/>
    <path d="M112 38 C134 48 146 72 142 100 C140 120 132 134 118 142 C128 124 132 104 128 82 C126 64 120 50 112 38Z" fill="#A9634F"/>
    <path d="M62 84 C62 66 72 50 90 44 C80 56 74 70 74 86Z" fill="#E6B597"/>
    <path d="M66 102 C70 112 78 118 86 118 C80 110 76 104 74 98Z" fill="#C46652" opacity=".85"/>
    <path d="M118 104 C122 110 126 116 130 118 C126 108 126 102 124 96Z" fill="#8E5A48" opacity=".8"/>
    <path d="M70 72 C80 66 92 66 98 72 C92 76 78 78 70 72Z M102 72 C110 66 124 66 132 72 C124 78 110 76 102 72Z" fill="#9C5847"/>
  </g>
  <g filter="url(#hp-cut)">
    <path d="M56 66 C54 36 80 20 106 22 C134 24 152 42 148 70 C142 54 128 44 110 44 C92 44 78 50 70 58 C64 62 60 64 56 66Z" fill="#4E3F35"/>
    <path d="M66 36 C80 26 102 22 122 28" stroke="#86796D" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M60 52 C66 42 78 36 90 34" stroke="#6F6358" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M128 34 C138 40 146 50 148 62" stroke="#7A6D62" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M58 86 C56 114 68 142 98 150 C130 144 144 116 142 86 C138 102 134 114 124 120 C112 112 88 112 76 120 C66 114 62 102 58 86Z" fill="#473629"/>
    <path d="M66 126 C76 140 92 146 108 146 M124 132 C130 124 134 114 136 104" stroke="#80715F" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M74 112 C86 102 114 102 126 112 C118 120 108 116 100 119 C92 116 82 120 74 112Z" fill="#362920"/>
    <path d="M86 122 C92 126 108 126 114 122 C110 132 90 132 86 122Z" fill="#3A1D18"/>
  </g>
  <g filter="url(#hp-cut)">
    <path d="M95 74 C91 88 84 98 88 106 C93 111 107 111 111 105 C114 98 106 88 103 74Z" fill="#C5664F"/>
    <ellipse cx="99" cy="104" rx="10" ry="7" fill="#C04A3C"/>
    <ellipse cx="81" cy="82" rx="10" ry="5.2" fill="#BC4B40"/>
    <ellipse cx="119" cy="82" rx="10" ry="5.2" fill="#AD4236"/>
    <ellipse cx="81" cy="82.4" rx="6.4" ry="2.6" fill="#E9DAC6"/>
    <ellipse cx="119" cy="82.4" rx="6.4" ry="2.6" fill="#DFCDB9"/>
    <circle cx="83" cy="82.5" r="2" fill="#221512"/>
    <circle cx="121" cy="82.5" r="2" fill="#221512"/>
    <path d="M72 90 Q81 95 90 90 M110 90 Q119 95 128 90" stroke="#9A5246" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  </g>
  <path d="M68 73 Q80 63 94 71" stroke="#30231C" stroke-width="5.4" fill="none" stroke-linecap="round"/>
  <path d="M106 71 Q120 63 132 72" stroke="#30231C" stroke-width="5.4" fill="none" stroke-linecap="round"/>
  <path d="M86 50 Q100 45 116 50" stroke="#F0C8AA" stroke-width="4.4" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M84 60 Q98 57 110 60" stroke="#B87A62" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/>
  <path d="M97 78 L95 94" stroke="#E6AE93" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/>
  <path d="M93 100 Q96 98 99 99" stroke="#E98E7E" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M130 70 C134 84 134 96 130 106" stroke="#7D8A64" stroke-width="3" fill="none" stroke-linecap="round" opacity=".45"/>
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
    <path d="M22 184 C36 168 52 158 66 154" stroke="#F19C50" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M44 200 C52 190 60 184 70 180" stroke="#F19C50" stroke-width="3.6" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M101 150 L103 214" stroke="#5F2C12" stroke-width="2.6"/>
    <circle cx="134" cy="180" r="8" fill="#EDE6D8"/>
    <circle cx="134" cy="180" r="4.4" fill="none" stroke="#8B857B" stroke-width="1.3"/>
  </g>
  <g filter="url(#kp-cut)">
    <path d="M84 114 L118 114 L118 138 L101 146 L84 138Z" fill="#AF7454"/>
    <path d="M78 134 L101 152 L124 134 L118 128 L101 142 L84 128Z" fill="#3A3029"/>
    <path d="M60 136 C70 128 80 126 86 128 L101 150 L78 164 C70 156 64 146 60 136Z" fill="#C05F22"/>
    <path d="M142 136 C132 128 122 126 116 128 L101 150 L124 164 C132 156 138 146 142 136Z" fill="#96461A"/>
  </g>
  <g filter="url(#kp-cut)">
    <ellipse cx="66" cy="88" rx="6" ry="11" fill="#C48B67"/>
    <ellipse cx="136" cy="88" rx="6" ry="11" fill="#A26A4B"/>
    <path d="M67 80 C67 54 82 40 101 40 C121 40 135 54 135 80 C135 98 131 112 124 122 C117 130 109 134 101 134 C93 134 85 130 78 122 C71 112 67 98 67 80Z" fill="#D7A27C"/>
    <path d="M114 44 C130 54 136 76 132 98 C130 112 124 124 112 130 C120 112 122 92 120 74 C119 62 117 52 114 44Z" fill="#A86C4C"/>
    <path d="M72 76 C72 62 80 50 92 46 C84 58 80 68 80 82Z" fill="#E6B894"/>
    <path d="M76 104 C80 114 86 120 94 124" stroke="#B97A58" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
  </g>
  <g filter="url(#kp-cut)">
    <path d="M66 80 C62 54 76 36 100 34 C124 32 140 48 137 76 C134 64 128 58 120 56 C120 50 116 46 108 46 C96 46 84 50 76 58 C70 64 68 72 66 80Z" fill="#1A1613"/>
    <path d="M78 46 C86 30 108 22 128 30 C136 34 140 42 140 50 C132 42 120 38 106 40 C94 42 84 46 78 46Z" fill="#1A1613"/>
    <path d="M90 36 C102 30 118 30 128 36" stroke="#4A4540" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M66 80 L67 96 L71 96 L71 76Z M137 76 L136 96 L132 96 L132 74Z" fill="#1A1613"/>
  </g>
  <circle cx="86" cy="86" r="12" fill="#E9EEF0" fill-opacity=".2" stroke="#161412" stroke-width="3.4"/>
  <circle cx="116" cy="86" r="12" fill="#E9EEF0" fill-opacity=".16" stroke="#161412" stroke-width="3.4"/>
  <path d="M98 84 Q101 81.5 104 84" stroke="#161412" stroke-width="2.6" fill="none"/>
  <path d="M74 84 L67 81 M128 84 L135 81" stroke="#161412" stroke-width="2.6"/>
  <ellipse cx="86" cy="87" rx="2.8" ry="1.9" fill="#251913"/>
  <ellipse cx="116" cy="87" rx="2.8" ry="1.9" fill="#251913"/>
  <path d="M79 80 Q83 77.5 87 78.5 M109 78.5 Q113 77.5 117 80" stroke="#F5F1EA" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>
  <path d="M77 71 Q86 67 95 71 M107 71 Q116 67 125 71" stroke="#211813" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M101 92 C99 100 97 104 99 106 C101 107.5 104 106.5 105 104.5" stroke="#915B3C" stroke-width="2.1" fill="none" stroke-linecap="round"/>
  <path d="M92 116 Q101 118 110 115.5" stroke="#733F2E" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M84 56 Q97 52 112 55" stroke="#EDC3A1" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".55"/>
  </g>
</g>
</svg>`;
