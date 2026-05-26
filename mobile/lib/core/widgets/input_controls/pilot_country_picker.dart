import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/country_list.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/bottom_sheets/pilot_bottom_sheet_base.dart';

class PilotCountryPicker extends StatefulWidget {
  final CountryEntity? initial;

  const PilotCountryPicker._({this.initial});

  static Future<CountryEntity?> show(
    BuildContext context, {
    CountryEntity? initial,
  }) {
    return PilotBottomSheetBase.show<CountryEntity>(
      context: context,
      sheet: PilotCountryPicker._(initial: initial),
    );
  }

  @override
  State<PilotCountryPicker> createState() => _PilotCountryPickerState();
}

class _PilotCountryPickerState extends State<PilotCountryPicker> {
  late List<CountryEntity> _filtered;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filtered = CountryList.all;
  }

  void _filterCountries(String query) {
    final q = query.toLowerCase().trim();
    setState(() {
      _filtered = q.isEmpty
          ? CountryList.all
          : CountryList.all
              .where((c) => c.name.toLowerCase().contains(q))
              .toList();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return PilotBottomSheetShell(
      title: 'Select Country',
      isContentScrollable: false,
      maxHeightFraction: 0.85,
      content: Column(
        children: [
          // ── Search bar ───────────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 8.h),
            child: Container(
              height: 44.h,
              padding: EdgeInsets.symmetric(horizontal: 12.w),
              decoration: BoxDecoration(
                color: colors.fill.alter,
                borderRadius: BorderRadius.circular(10.r),
                border: Border.all(color: colors.border.main),
              ),
              child: Row(
                children: [
                  SvgPicture.asset(
                    PilotAssets.kNotifSearch,
                    width: 18.r,
                    height: 18.r,
                    colorFilter: ColorFilter.mode(
                      colors.text.tertiary,
                      BlendMode.srcIn,
                    ),
                  ),
                  Gap(8.w),
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      autofocus: true,
                      onChanged: _filterCountries,
                      style: texts.body
                          .regular()
                          .copyWith(color: colors.text.primary),
                      cursorColor: colors.primary.main,
                      decoration: InputDecoration(
                        hintText: 'Search country…',
                        hintStyle: texts.body
                            .regular()
                            .copyWith(color: colors.text.tertiary),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Country list ─────────────────────────────────────────────────
          Expanded(
            child: _filtered.isEmpty
                ? Center(
                    child: Text(
                      'No countries found',
                      style: texts.body
                          .regular()
                          .copyWith(color: colors.text.secondary),
                    ),
                  )
                : ListView.separated(
                    itemCount: _filtered.length,
                    padding: EdgeInsets.only(bottom: 16.h),
                    separatorBuilder: (_, __) => Divider(
                      height: 1,
                      thickness: 0.5,
                      indent: 20.w,
                      endIndent: 20.w,
                      color: colors.border.main.withValues(alpha: 0.4),
                    ),
                    itemBuilder: (_, i) {
                      final country = _filtered[i];
                      final isSelected =
                          widget.initial?.name == country.name;
                      return InkWell(
                        onTap: () => Navigator.of(context).pop(country),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 20.w,
                            vertical: 14.h,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  country.name,
                                  style: texts.body.regular().copyWith(
                                        color: isSelected
                                            ? colors.primary.main
                                            : colors.text.primary,
                                      ),
                                ),
                              ),
                              if (isSelected)
                                SvgPicture.asset(
                                  PilotAssets.kCheck,
                                  width: 16.r,
                                  height: 16.r,
                                  colorFilter: ColorFilter.mode(
                                    colors.primary.main,
                                    BlendMode.srcIn,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
