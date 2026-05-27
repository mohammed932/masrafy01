import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/enums/request_state.dart';
import 'package:app/core/features/notes/cubit/notes_cubit.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/dialogs/masrafy_info_dialog.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer_line.dart';
import 'package:app/features/study_session/domain/entities/user_note_entity.dart';

part 'notes_panel.dart';
part 'notes_skeleton.dart';
