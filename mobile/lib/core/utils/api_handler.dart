import 'dart:developer';

import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../result/failure.dart';

/// Generic API wrapper for the repository layer (Constitution Principle
/// XXX). Wraps a datasource call, catches the masrafy-relevant error
/// shapes, and emits `Either<Failure, T>` so call sites are uniform.
///
/// Pilot100 inspired the shape; masrafy keeps only the failure modes
/// that apply today:
///   - `DioException`  → `NetworkFailure` (timeout / no connection)
///                   OR `ServerFailure`  (4xx/5xx with the backend's
///                                        `{ success:false, code, meta }`
///                                        envelope)
///   - anything else   → `UnknownFailure`
///
/// New auth- or document-specific failure subtypes get added to
/// `failure.dart` and the caller folds `ServerFailure.code` into a
/// typed `*Failure` at the repository boundary — keeping endpoint-
/// specific mapping out of this generic handler.
class ApiHandler {
  ApiHandler._();

  static Future<Either<Failure, T>> callApi<T>(Future<T> Function() call) async {
    try {
      return Right(await call());
    } on DioException catch (e) {
      return Left(failureFromDio(e));
    } catch (e, st) {
      log('ApiHandler.callApi<$T> uncaught: $e\n$st');
      return const Left(UnknownFailure());
    }
  }
}
