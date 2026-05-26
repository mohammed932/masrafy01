import 'package:dartz/dartz.dart' hide State;
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/features/chart_annotator/chart_annotator.dart';
import 'package:app/core/injection/injection.dart';
import 'package:app/core/network/erros/failure_messages.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/answer_options/pilot_answer_option.dart';
import 'package:app/core/widgets/bottom_sheets/pilot_peek_bottom_sheet.dart';
import 'package:app/core/widgets/common/pilot_html.dart';
import 'package:app/core/widgets/dialogs/pilot_confirm_dialog.dart';
import 'package:app/features/attachments/domain/entities/attachment_url_entity.dart';
import 'package:app/features/attachments/domain/usecases/attachments_usecase.dart';
import 'package:app/features/study_session/domain/entities/attachment_entity.dart';

part 'attachment_editor_screen.dart';
