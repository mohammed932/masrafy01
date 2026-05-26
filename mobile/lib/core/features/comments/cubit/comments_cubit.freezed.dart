// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'comments_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$CommentsState {
  List<CommentEntity> get comments => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  CommentSortOption get sort => throw _privateConstructorUsedError;
  RequestState get loadState => throw _privateConstructorUsedError;
  bool get isLoadingMore => throw _privateConstructorUsedError;
  bool get isPosting => throw _privateConstructorUsedError;
  String get composerText => throw _privateConstructorUsedError;
  String? get replyToCommentId => throw _privateConstructorUsedError;
  Map<String, CommentReaction> get myReactions =>
      throw _privateConstructorUsedError;
  bool get isTrialLocked => throw _privateConstructorUsedError;
  bool get hasSeenGuidelines => throw _privateConstructorUsedError;
  String? get errorMessage => throw _privateConstructorUsedError;

  /// Create a copy of CommentsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CommentsStateCopyWith<CommentsState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CommentsStateCopyWith<$Res> {
  factory $CommentsStateCopyWith(
          CommentsState value, $Res Function(CommentsState) then) =
      _$CommentsStateCopyWithImpl<$Res, CommentsState>;
  @useResult
  $Res call(
      {List<CommentEntity> comments,
      int total,
      int page,
      CommentSortOption sort,
      RequestState loadState,
      bool isLoadingMore,
      bool isPosting,
      String composerText,
      String? replyToCommentId,
      Map<String, CommentReaction> myReactions,
      bool isTrialLocked,
      bool hasSeenGuidelines,
      String? errorMessage});
}

/// @nodoc
class _$CommentsStateCopyWithImpl<$Res, $Val extends CommentsState>
    implements $CommentsStateCopyWith<$Res> {
  _$CommentsStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CommentsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? comments = null,
    Object? total = null,
    Object? page = null,
    Object? sort = freezed,
    Object? loadState = null,
    Object? isLoadingMore = null,
    Object? isPosting = null,
    Object? composerText = null,
    Object? replyToCommentId = freezed,
    Object? myReactions = null,
    Object? isTrialLocked = null,
    Object? hasSeenGuidelines = null,
    Object? errorMessage = freezed,
  }) {
    return _then(_value.copyWith(
      comments: null == comments
          ? _value.comments
          : comments // ignore: cast_nullable_to_non_nullable
              as List<CommentEntity>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as int,
      sort: freezed == sort
          ? _value.sort
          : sort // ignore: cast_nullable_to_non_nullable
              as CommentSortOption,
      loadState: null == loadState
          ? _value.loadState
          : loadState // ignore: cast_nullable_to_non_nullable
              as RequestState,
      isLoadingMore: null == isLoadingMore
          ? _value.isLoadingMore
          : isLoadingMore // ignore: cast_nullable_to_non_nullable
              as bool,
      isPosting: null == isPosting
          ? _value.isPosting
          : isPosting // ignore: cast_nullable_to_non_nullable
              as bool,
      composerText: null == composerText
          ? _value.composerText
          : composerText // ignore: cast_nullable_to_non_nullable
              as String,
      replyToCommentId: freezed == replyToCommentId
          ? _value.replyToCommentId
          : replyToCommentId // ignore: cast_nullable_to_non_nullable
              as String?,
      myReactions: null == myReactions
          ? _value.myReactions
          : myReactions // ignore: cast_nullable_to_non_nullable
              as Map<String, CommentReaction>,
      isTrialLocked: null == isTrialLocked
          ? _value.isTrialLocked
          : isTrialLocked // ignore: cast_nullable_to_non_nullable
              as bool,
      hasSeenGuidelines: null == hasSeenGuidelines
          ? _value.hasSeenGuidelines
          : hasSeenGuidelines // ignore: cast_nullable_to_non_nullable
              as bool,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CommentsStateImplCopyWith<$Res>
    implements $CommentsStateCopyWith<$Res> {
  factory _$$CommentsStateImplCopyWith(
          _$CommentsStateImpl value, $Res Function(_$CommentsStateImpl) then) =
      __$$CommentsStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<CommentEntity> comments,
      int total,
      int page,
      CommentSortOption sort,
      RequestState loadState,
      bool isLoadingMore,
      bool isPosting,
      String composerText,
      String? replyToCommentId,
      Map<String, CommentReaction> myReactions,
      bool isTrialLocked,
      bool hasSeenGuidelines,
      String? errorMessage});
}

/// @nodoc
class __$$CommentsStateImplCopyWithImpl<$Res>
    extends _$CommentsStateCopyWithImpl<$Res, _$CommentsStateImpl>
    implements _$$CommentsStateImplCopyWith<$Res> {
  __$$CommentsStateImplCopyWithImpl(
      _$CommentsStateImpl _value, $Res Function(_$CommentsStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of CommentsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? comments = null,
    Object? total = null,
    Object? page = null,
    Object? sort = freezed,
    Object? loadState = null,
    Object? isLoadingMore = null,
    Object? isPosting = null,
    Object? composerText = null,
    Object? replyToCommentId = freezed,
    Object? myReactions = null,
    Object? isTrialLocked = null,
    Object? hasSeenGuidelines = null,
    Object? errorMessage = freezed,
  }) {
    return _then(_$CommentsStateImpl(
      comments: null == comments
          ? _value._comments
          : comments // ignore: cast_nullable_to_non_nullable
              as List<CommentEntity>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as int,
      sort: freezed == sort
          ? _value.sort
          : sort // ignore: cast_nullable_to_non_nullable
              as CommentSortOption,
      loadState: null == loadState
          ? _value.loadState
          : loadState // ignore: cast_nullable_to_non_nullable
              as RequestState,
      isLoadingMore: null == isLoadingMore
          ? _value.isLoadingMore
          : isLoadingMore // ignore: cast_nullable_to_non_nullable
              as bool,
      isPosting: null == isPosting
          ? _value.isPosting
          : isPosting // ignore: cast_nullable_to_non_nullable
              as bool,
      composerText: null == composerText
          ? _value.composerText
          : composerText // ignore: cast_nullable_to_non_nullable
              as String,
      replyToCommentId: freezed == replyToCommentId
          ? _value.replyToCommentId
          : replyToCommentId // ignore: cast_nullable_to_non_nullable
              as String?,
      myReactions: null == myReactions
          ? _value._myReactions
          : myReactions // ignore: cast_nullable_to_non_nullable
              as Map<String, CommentReaction>,
      isTrialLocked: null == isTrialLocked
          ? _value.isTrialLocked
          : isTrialLocked // ignore: cast_nullable_to_non_nullable
              as bool,
      hasSeenGuidelines: null == hasSeenGuidelines
          ? _value.hasSeenGuidelines
          : hasSeenGuidelines // ignore: cast_nullable_to_non_nullable
              as bool,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$CommentsStateImpl extends _CommentsState {
  const _$CommentsStateImpl(
      {final List<CommentEntity> comments = const [],
      this.total = 0,
      this.page = 0,
      this.sort = CommentSortOption.likes,
      this.loadState = RequestState.initial,
      this.isLoadingMore = false,
      this.isPosting = false,
      this.composerText = '',
      this.replyToCommentId,
      final Map<String, CommentReaction> myReactions = const {},
      this.isTrialLocked = false,
      this.hasSeenGuidelines = false,
      this.errorMessage})
      : _comments = comments,
        _myReactions = myReactions,
        super._();

  final List<CommentEntity> _comments;
  @override
  @JsonKey()
  List<CommentEntity> get comments {
    if (_comments is EqualUnmodifiableListView) return _comments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_comments);
  }

  @override
  @JsonKey()
  final int total;
  @override
  @JsonKey()
  final int page;
  @override
  @JsonKey()
  final CommentSortOption sort;
  @override
  @JsonKey()
  final RequestState loadState;
  @override
  @JsonKey()
  final bool isLoadingMore;
  @override
  @JsonKey()
  final bool isPosting;
  @override
  @JsonKey()
  final String composerText;
  @override
  final String? replyToCommentId;
  final Map<String, CommentReaction> _myReactions;
  @override
  @JsonKey()
  Map<String, CommentReaction> get myReactions {
    if (_myReactions is EqualUnmodifiableMapView) return _myReactions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_myReactions);
  }

  @override
  @JsonKey()
  final bool isTrialLocked;
  @override
  @JsonKey()
  final bool hasSeenGuidelines;
  @override
  final String? errorMessage;

  @override
  String toString() {
    return 'CommentsState(comments: $comments, total: $total, page: $page, sort: $sort, loadState: $loadState, isLoadingMore: $isLoadingMore, isPosting: $isPosting, composerText: $composerText, replyToCommentId: $replyToCommentId, myReactions: $myReactions, isTrialLocked: $isTrialLocked, hasSeenGuidelines: $hasSeenGuidelines, errorMessage: $errorMessage)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CommentsStateImpl &&
            const DeepCollectionEquality().equals(other._comments, _comments) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            const DeepCollectionEquality().equals(other.sort, sort) &&
            (identical(other.loadState, loadState) ||
                other.loadState == loadState) &&
            (identical(other.isLoadingMore, isLoadingMore) ||
                other.isLoadingMore == isLoadingMore) &&
            (identical(other.isPosting, isPosting) ||
                other.isPosting == isPosting) &&
            (identical(other.composerText, composerText) ||
                other.composerText == composerText) &&
            (identical(other.replyToCommentId, replyToCommentId) ||
                other.replyToCommentId == replyToCommentId) &&
            const DeepCollectionEquality()
                .equals(other._myReactions, _myReactions) &&
            (identical(other.isTrialLocked, isTrialLocked) ||
                other.isTrialLocked == isTrialLocked) &&
            (identical(other.hasSeenGuidelines, hasSeenGuidelines) ||
                other.hasSeenGuidelines == hasSeenGuidelines) &&
            (identical(other.errorMessage, errorMessage) ||
                other.errorMessage == errorMessage));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_comments),
      total,
      page,
      const DeepCollectionEquality().hash(sort),
      loadState,
      isLoadingMore,
      isPosting,
      composerText,
      replyToCommentId,
      const DeepCollectionEquality().hash(_myReactions),
      isTrialLocked,
      hasSeenGuidelines,
      errorMessage);

  /// Create a copy of CommentsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CommentsStateImplCopyWith<_$CommentsStateImpl> get copyWith =>
      __$$CommentsStateImplCopyWithImpl<_$CommentsStateImpl>(this, _$identity);
}

abstract class _CommentsState extends CommentsState {
  const factory _CommentsState(
      {final List<CommentEntity> comments,
      final int total,
      final int page,
      final CommentSortOption sort,
      final RequestState loadState,
      final bool isLoadingMore,
      final bool isPosting,
      final String composerText,
      final String? replyToCommentId,
      final Map<String, CommentReaction> myReactions,
      final bool isTrialLocked,
      final bool hasSeenGuidelines,
      final String? errorMessage}) = _$CommentsStateImpl;
  const _CommentsState._() : super._();

  @override
  List<CommentEntity> get comments;
  @override
  int get total;
  @override
  int get page;
  @override
  CommentSortOption get sort;
  @override
  RequestState get loadState;
  @override
  bool get isLoadingMore;
  @override
  bool get isPosting;
  @override
  String get composerText;
  @override
  String? get replyToCommentId;
  @override
  Map<String, CommentReaction> get myReactions;
  @override
  bool get isTrialLocked;
  @override
  bool get hasSeenGuidelines;
  @override
  String? get errorMessage;

  /// Create a copy of CommentsState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CommentsStateImplCopyWith<_$CommentsStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
