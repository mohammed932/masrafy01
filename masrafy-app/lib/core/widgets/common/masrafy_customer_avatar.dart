import 'package:flutter/material.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/features/customer_photo/customer_photo_store.dart';
import 'package:app/core/widgets/common/masrafy_avatar.dart';

/// The signed-in customer's avatar, wherever it is shown.
///
/// Use this — not [MasrafyAvatar] directly — for the account holder's own
/// picture: it listens to [CustomerPhotoStore], so a photo uploaded on any
/// screen repaints here instantly instead of waiting for this screen's next
/// `/me` read. [MasrafyAvatar] stays the plain widget for any OTHER person's
/// image (a bank logo, an agent, a list row).
///
/// [fallbackUrl] is this screen's own last-known URL, used only until the store
/// has something newer.
class MasrafyCustomerAvatar extends StatelessWidget {
  const MasrafyCustomerAvatar({
    super.key,
    required this.size,
    this.fallbackUrl,
    this.borderColor,
    this.borderWidth,
  });

  final double size;
  final String? fallbackUrl;
  final Color? borderColor;
  final double? borderWidth;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<CustomerPhoto>(
      valueListenable: getIt<CustomerPhotoStore>(),
      builder: (_, photo, __) => MasrafyAvatar(
        size: size,
        // Bytes win; the store's URL beats the caller's, which is only a seed.
        imageUrl: photo.bytes != null ? null : (photo.url ?? fallbackUrl),
        imageBytes: photo.bytes,
        borderColor: borderColor,
        borderWidth: borderWidth,
      ),
    );
  }
}
