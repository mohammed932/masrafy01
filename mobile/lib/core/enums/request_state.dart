/// Represents the lifecycle state of a data-fetching operation.
enum RequestState { initial, loading, loaded, error }

extension RequestStateExtension on RequestState {
  bool get isLoading => this == RequestState.loading;
  bool get isError => this == RequestState.error;
  bool get isLoaded => this == RequestState.loaded;
  bool get isInitial => this == RequestState.initial;
}