import 'package:flutter/material.dart';

class MasrafyColorPalette {
  const MasrafyColorPalette({
    required this.blue,
    required this.cyan,
    required this.geekblue,
    required this.gold,
    required this.green,
    required this.lime,
    required this.magenta,
    required this.orange,
    required this.pink,
    required this.purple,
    required this.red,
    required this.volcano,
    required this.yellow,
  });

  final MasrafyColorShades blue;
  final MasrafyColorShades cyan;
  final MasrafyColorShades geekblue;
  final MasrafyColorShades gold;
  final MasrafyColorShades green;
  final MasrafyColorShades lime;
  final MasrafyColorShades magenta;
  final MasrafyColorShades orange;
  final MasrafyColorShades pink;
  final MasrafyColorShades purple;
  final MasrafyColorShades red;
  final MasrafyColorShades volcano;
  final MasrafyColorShades yellow;

  static const light = MasrafyColorPalette(
    blue: _lightBlue,
    cyan: _lightCyan,
    geekblue: _lightGeekblue,
    gold: _lightGold,
    green: _lightGreen,
    lime: _lightLime,
    magenta: _lightMagenta,
    orange: _lightOrange,
    pink: _lightPink,
    purple: _lightPurple,
    red: _lightRed,
    volcano: _lightVolcano,
    yellow: _lightYellow,
  );

  static const dark = MasrafyColorPalette(
    blue: _darkBlue,
    cyan: _darkCyan,
    geekblue: _darkGeekblue,
    gold: _darkGold,
    green: _darkGreen,
    lime: _darkLime,
    magenta: _darkMagenta,
    orange: _darkOrange,
    pink: _darkPink,
    purple: _darkPurple,
    red: _darkRed,
    volcano: _darkVolcano,
    yellow: _darkYellow,
  );

  MasrafyColorPalette lerp(MasrafyColorPalette other, double t) {
    return MasrafyColorPalette(
      blue: blue.lerp(other.blue, t),
      cyan: cyan.lerp(other.cyan, t),
      geekblue: geekblue.lerp(other.geekblue, t),
      gold: gold.lerp(other.gold, t),
      green: green.lerp(other.green, t),
      lime: lime.lerp(other.lime, t),
      magenta: magenta.lerp(other.magenta, t),
      orange: orange.lerp(other.orange, t),
      pink: pink.lerp(other.pink, t),
      purple: purple.lerp(other.purple, t),
      red: red.lerp(other.red, t),
      volcano: volcano.lerp(other.volcano, t),
      yellow: yellow.lerp(other.yellow, t),
    );
  }
}

class MasrafyColorShades {
  const MasrafyColorShades({
    required this.shade1,
    required this.shade2,
    required this.shade3,
    required this.shade4,
    required this.shade5,
    required this.shade6,
    required this.shade7,
    required this.shade8,
    required this.shade9,
    required this.shade10,
  });

  final Color shade1;
  final Color shade2;
  final Color shade3;
  final Color shade4;
  final Color shade5;
  final Color shade6;
  final Color shade7;
  final Color shade8;
  final Color shade9;
  final Color shade10;

  MasrafyColorShades lerp(MasrafyColorShades other, double t) {
    return MasrafyColorShades(
      shade1: Color.lerp(shade1, other.shade1, t) ?? shade1,
      shade2: Color.lerp(shade2, other.shade2, t) ?? shade2,
      shade3: Color.lerp(shade3, other.shade3, t) ?? shade3,
      shade4: Color.lerp(shade4, other.shade4, t) ?? shade4,
      shade5: Color.lerp(shade5, other.shade5, t) ?? shade5,
      shade6: Color.lerp(shade6, other.shade6, t) ?? shade6,
      shade7: Color.lerp(shade7, other.shade7, t) ?? shade7,
      shade8: Color.lerp(shade8, other.shade8, t) ?? shade8,
      shade9: Color.lerp(shade9, other.shade9, t) ?? shade9,
      shade10: Color.lerp(shade10, other.shade10, t) ?? shade10,
    );
  }
}

const _lightBlue = MasrafyColorShades(
  shade1: Color(0xFFE6F4FF),
  shade2: Color(0xFFBAE0FF),
  shade3: Color(0xFF91CAFF),
  shade4: Color(0xFF69B1FF),
  shade5: Color(0xFF4096FF),
  shade6: Color(0xFF1677FF),
  shade7: Color(0xFF0958D9),
  shade8: Color(0xFF003EB3),
  shade9: Color(0xFF002C8C),
  shade10: Color(0xFF001D66),
);

const _lightCyan = MasrafyColorShades(
  shade1: Color(0xFFF3FAF9),
  shade2: Color(0xFFD7F0EE),
  shade3: Color(0xFFAEE1DE),
  shade4: Color(0xFF7DCBC8),
  shade5: Color(0xFF53ADAE),
  shade6: Color(0xFF338284),
  shade7: Color(0xFF2B7376),
  shade8: Color(0xFF265C5F),
  shade9: Color(0xFF224A4D),
  shade10: Color(0xFF203F41),
);

const _lightGeekblue = MasrafyColorShades(
  shade1: Color(0xFFF0F5FF),
  shade2: Color(0xFFD6E4FF),
  shade3: Color(0xFFADC6FF),
  shade4: Color(0xFF85A5FF),
  shade5: Color(0xFF597EF7),
  shade6: Color(0xFF2F54EB),
  shade7: Color(0xFF1D39C4),
  shade8: Color(0xFF10239E),
  shade9: Color(0xFF061178),
  shade10: Color(0xFF030852),
);

const _lightGold = MasrafyColorShades(
  shade1: Color(0xFFFFFBE6),
  shade2: Color(0xFFFFF1B8),
  shade3: Color(0xFFFFE58F),
  shade4: Color(0xFFFFD666),
  shade5: Color(0xFFFFC53D),
  shade6: Color(0xFFFAAD14),
  shade7: Color(0xFFD48806),
  shade8: Color(0xFFAD6800),
  shade9: Color(0xFF874D00),
  shade10: Color(0xFF613400),
);

const _lightGreen = MasrafyColorShades(
  shade1: Color(0xFFF6FFED),
  shade2: Color(0xFFD9F7BE),
  shade3: Color(0xFFB7EB8F),
  shade4: Color(0xFF95DE64),
  shade5: Color(0xFF73D13D),
  shade6: Color(0xFF52C41A),
  shade7: Color(0xFF389E0D),
  shade8: Color(0xFF237804),
  shade9: Color(0xFF135200),
  shade10: Color(0xFF092B00),
);

const _lightLime = MasrafyColorShades(
  shade1: Color(0xFFFCFFE6),
  shade2: Color(0xFFF4FFB8),
  shade3: Color(0xFFEAFF8F),
  shade4: Color(0xFFD3F261),
  shade5: Color(0xFFBAE637),
  shade6: Color(0xFFA0D911),
  shade7: Color(0xFF7CB305),
  shade8: Color(0xFF5B8C00),
  shade9: Color(0xFF3F6600),
  shade10: Color(0xFF254000),
);

const _lightMagenta = MasrafyColorShades(
  shade1: Color(0xFFFFF0F6),
  shade2: Color(0xFFFFD6E7),
  shade3: Color(0xFFFFADD2),
  shade4: Color(0xFFFF85C0),
  shade5: Color(0xFFF759AB),
  shade6: Color(0xFFEB2F96),
  shade7: Color(0xFFC41D7F),
  shade8: Color(0xFF9E1068),
  shade9: Color(0xFF780650),
  shade10: Color(0xFF520339),
);

const _lightOrange = MasrafyColorShades(
  shade1: Color(0xFFFFF7E6),
  shade2: Color(0xFFFFE7BA),
  shade3: Color(0xFFFFD591),
  shade4: Color(0xFFFFC069),
  shade5: Color(0xFFFFA940),
  shade6: Color(0xFFFA8C16),
  shade7: Color(0xFFD46B08),
  shade8: Color(0xFFAD4E00),
  shade9: Color(0xFF873800),
  shade10: Color(0xFF612500),
);

const _lightPink = _lightMagenta;

const _lightPurple = MasrafyColorShades(
  shade1: Color(0xFFF9F0FF),
  shade2: Color(0xFFEFDBFF),
  shade3: Color(0xFFD3ADF7),
  shade4: Color(0xFFB37FEB),
  shade5: Color(0xFF9254DE),
  shade6: Color(0xFF722ED1),
  shade7: Color(0xFF531DAB),
  shade8: Color(0xFF391085),
  shade9: Color(0xFF22075E),
  shade10: Color(0xFF120338),
);

const _lightRed = MasrafyColorShades(
  shade1: Color(0xFFFFF1F0),
  shade2: Color(0xFFFFCCC7),
  shade3: Color(0xFFFFA39E),
  shade4: Color(0xFFFF7875),
  shade5: Color(0xFFFF4D4F),
  shade6: Color(0xFFF5222D),
  shade7: Color(0xFFCF1322),
  shade8: Color(0xFFA8071A),
  shade9: Color(0xFF820014),
  shade10: Color(0xFF5C0011),
);

const _lightVolcano = MasrafyColorShades(
  shade1: Color(0xFFFFF2E8),
  shade2: Color(0xFFFFD8BF),
  shade3: Color(0xFFFFBB96),
  shade4: Color(0xFFFF9C6E),
  shade5: Color(0xFFFF7A45),
  shade6: Color(0xFFFA541C),
  shade7: Color(0xFFD4380D),
  shade8: Color(0xFFAD2102),
  shade9: Color(0xFF871400),
  shade10: Color(0xFF610B00),
);

const _lightYellow = MasrafyColorShades(
  shade1: Color(0xFFFEFFE6),
  shade2: Color(0xFFFFFFB8),
  shade3: Color(0xFFFFFB8F),
  shade4: Color(0xFFFFF566),
  shade5: Color(0xFFFFEC3D),
  shade6: Color(0xFFFADB14),
  shade7: Color(0xFFD4B106),
  shade8: Color(0xFFAD8B00),
  shade9: Color(0xFF876800),
  shade10: Color(0xFF614700),
);

const _darkBlue = MasrafyColorShades(
  shade1: Color(0xFF111A2C),
  shade2: Color(0xFF112545),
  shade3: Color(0xFF15325B),
  shade4: Color(0xFF15417E),
  shade5: Color(0xFF1554AD),
  shade6: Color(0xFF1668DC),
  shade7: Color(0xFF3C89E8),
  shade8: Color(0xFF65A9F3),
  shade9: Color(0xFF8DC5F8),
  shade10: Color(0xFFB7DCFA),
);

const _darkCyan = MasrafyColorShades(
  shade1: Color(0xFF0E2225),
  shade2: Color(0xFF203F41),
  shade3: Color(0xFF224A4D),
  shade4: Color(0xFF265C5F),
  shade5: Color(0xFF2B7376),
  shade6: Color(0xFF338284),
  shade7: Color(0xFF53ADAE),
  shade8: Color(0xFF7DCBC8),
  shade9: Color(0xFFAEE1DE),
  shade10: Color(0xFFD7F0EE),
);

const _darkGeekblue = MasrafyColorShades(
  shade1: Color(0xFF131629),
  shade2: Color(0xFF161D40),
  shade3: Color(0xFF1C2755),
  shade4: Color(0xFF203175),
  shade5: Color(0xFF263EA0),
  shade6: Color(0xFF2B4ACB),
  shade7: Color(0xFF5273E0),
  shade8: Color(0xFF7F9EF3),
  shade9: Color(0xFFA8C1F8),
  shade10: Color(0xFFD2E0FA),
);

const _darkGold = MasrafyColorShades(
  shade1: Color(0xFF2B2111),
  shade2: Color(0xFF443111),
  shade3: Color(0xFF594214),
  shade4: Color(0xFF7C5914),
  shade5: Color(0xFFAA7714),
  shade6: Color(0xFFD89614),
  shade7: Color(0xFFE8B339),
  shade8: Color(0xFFF3CC62),
  shade9: Color(0xFFF8DF8B),
  shade10: Color(0xFFFAEDB5),
);

const _darkGreen = MasrafyColorShades(
  shade1: Color(0xFF162312),
  shade2: Color(0xFF1D3712),
  shade3: Color(0xFF274916),
  shade4: Color(0xFF306317),
  shade5: Color(0xFF3C8618),
  shade6: Color(0xFF49AA19),
  shade7: Color(0xFF6ABE39),
  shade8: Color(0xFF8FD460),
  shade9: Color(0xFFB2E58B),
  shade10: Color(0xFFD5F2BB),
);

const _darkLime = MasrafyColorShades(
  shade1: Color(0xFF1F2611),
  shade2: Color(0xFF2E3C10),
  shade3: Color(0xFF3E4F13),
  shade4: Color(0xFF536D13),
  shade5: Color(0xFF6F9412),
  shade6: Color(0xFF8BBB11),
  shade7: Color(0xFFA9D134),
  shade8: Color(0xFFC9E75D),
  shade9: Color(0xFFE4F88B),
  shade10: Color(0xFFF0FAB5),
);

const _darkMagenta = MasrafyColorShades(
  shade1: Color(0xFF291321),
  shade2: Color(0xFF40162F),
  shade3: Color(0xFF551C3B),
  shade4: Color(0xFF75204F),
  shade5: Color(0xFFA02669),
  shade6: Color(0xFFCB2B83),
  shade7: Color(0xFFE0529C),
  shade8: Color(0xFFF37FB7),
  shade9: Color(0xFFF8A8CC),
  shade10: Color(0xFFFAD2E3),
);

const _darkOrange = MasrafyColorShades(
  shade1: Color(0xFF2B1D11),
  shade2: Color(0xFF442A11),
  shade3: Color(0xFF593815),
  shade4: Color(0xFF7C4A15),
  shade5: Color(0xFFAA6215),
  shade6: Color(0xFFD87A16),
  shade7: Color(0xFFE89A3C),
  shade8: Color(0xFFF3B765),
  shade9: Color(0xFFF8CF8D),
  shade10: Color(0xFFFAE3B7),
);

const _darkPink = _darkMagenta;

const _darkPurple = MasrafyColorShades(
  shade1: Color(0xFF1A1325),
  shade2: Color(0xFF24163A),
  shade3: Color(0xFF301C4D),
  shade4: Color(0xFF3E2069),
  shade5: Color(0xFF51258F),
  shade6: Color(0xFF642AB5),
  shade7: Color(0xFF854ECA),
  shade8: Color(0xFFAB7AE0),
  shade9: Color(0xFFCDA8F0),
  shade10: Color(0xFFEBD7FA),
);

const _darkRed = MasrafyColorShades(
  shade1: Color(0xFF2A1215),
  shade2: Color(0xFF431418),
  shade3: Color(0xFF58181C),
  shade4: Color(0xFF791A1F),
  shade5: Color(0xFFA61D24),
  shade6: Color(0xFFD32029),
  shade7: Color(0xFFE84749),
  shade8: Color(0xFFF37370),
  shade9: Color(0xFFF89F9A),
  shade10: Color(0xFFFAC8C3),
);

const _darkVolcano = MasrafyColorShades(
  shade1: Color(0xFF2B1611),
  shade2: Color(0xFF441D12),
  shade3: Color(0xFF592716),
  shade4: Color(0xFF7C3118),
  shade5: Color(0xFFAA3E19),
  shade6: Color(0xFFD84A1B),
  shade7: Color(0xFFE87040),
  shade8: Color(0xFFF3956A),
  shade9: Color(0xFFF8B692),
  shade10: Color(0xFFFAD4BC),
);

const _darkYellow = MasrafyColorShades(
  shade1: Color(0xFF2B2611),
  shade2: Color(0xFF443B11),
  shade3: Color(0xFF595014),
  shade4: Color(0xFF7C6E14),
  shade5: Color(0xFFAA9514),
  shade6: Color(0xFFD8BD14),
  shade7: Color(0xFFE8D639),
  shade8: Color(0xFFF3EA62),
  shade9: Color(0xFFF8F48B),
  shade10: Color(0xFFFAFAB5),
);
